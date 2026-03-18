/**
 * Tickets Service
 *
 * CRUD operations, error capture with deduplication, and quota tracking
 * for the platform ticketing API. Follows feature-toggles-service pattern.
 */

import crypto from 'crypto';
import { sql } from '../lib/db';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Ticket {
  id: string;
  org_id: string;
  created_by_email: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_on_customer' | 'closed';
  category: 'technical' | 'billing' | 'feature_request' | 'bug' | 'other';
  assigned_to: string | null;
  app_id: string | null;
  environment: string | null;
  source: 'console' | 'api' | 'sdk' | 'auto-error';
  error_stack: string | null;
  error_context: Record<string, unknown> | null;
  error_fingerprint: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  org_name?: string;
  comment_count?: number;
  app_name?: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_email: string;
  author_type: 'customer' | 'admin' | 'system';
  message: string;
  created_at: string;
}

export interface TicketUsage {
  tickets_created: number;
  quota: number;
  remaining: number;
  month: string;
}

export interface CreateTicketParams {
  email: string;
  subject: string;
  description: string;
  priority?: string;
  category?: string;
  source?: string;
  appId?: string;
  environment?: string;
  tags?: string[];
}

export interface CreateErrorTicketParams {
  email?: string;
  errorMessage: string;
  errorStack?: string;
  errorContext?: Record<string, unknown>;
  category?: string;
  appId?: string;
  environment?: string;
  tags?: string[];
}

export interface ListTicketFilters {
  status?: string;
  priority?: string;
  category?: string;
  appId?: string;
  source?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateTicketParams {
  status?: string;
  priority?: string;
  category?: string;
  assigned_to?: string | null;
  tags?: string[];
}

// ─── Quota ──────────────────────────────────────────────────────────────────

async function getTicketQuotaLimit(orgId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(
      (bp.limits->>'ticket_monthly_limit')::bigint,
      50
    ) as ticket_limit
    FROM org_subscriptions os
    JOIN billing_plans bp ON bp.id = os.plan_id
    WHERE os.org_id = ${orgId}
  `;
  return rows.length > 0 ? Number(rows[0].ticket_limit) : 50;
}

export async function getTicketUsage(orgId: string): Promise<TicketUsage> {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const monthStr = currentMonth.toISOString().slice(0, 10);

  const [usageRows, quota] = await Promise.all([
    sql`
      SELECT tickets_created FROM ticket_usage
      WHERE organization_id = ${orgId} AND month = ${monthStr}
    `,
    getTicketQuotaLimit(orgId),
  ]);

  const ticketsCreated = usageRows.length > 0 ? Number(usageRows[0].tickets_created) : 0;
  const remaining = quota === 0 ? -1 : Math.max(0, quota - ticketsCreated);

  return {
    tickets_created: ticketsCreated,
    quota,
    remaining,
    month: monthStr,
  };
}

export async function checkTicketQuota(orgId: string): Promise<{ allowed: boolean; usage: TicketUsage }> {
  const usage = await getTicketUsage(orgId);
  const allowed = usage.quota === 0 || usage.tickets_created < usage.quota;
  return { allowed, usage };
}

async function incrementTicketUsage(orgId: string): Promise<void> {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const monthStr = currentMonth.toISOString().slice(0, 10);

  await sql`
    INSERT INTO ticket_usage (organization_id, month, tickets_created, updated_at)
    VALUES (${orgId}, ${monthStr}, 1, now())
    ON CONFLICT (organization_id, month)
    DO UPDATE SET tickets_created = ticket_usage.tickets_created + 1, updated_at = now()
  `;
}

// ─── Error Fingerprinting ───────────────────────────────────────────────────

function computeErrorFingerprint(stack: string, category: string): string {
  const normalizedStack = stack.slice(0, 500).trim();
  return crypto.createHash('sha256')
    .update(`${category}:${normalizedStack}`)
    .digest('hex')
    .slice(0, 32);
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createTicket(orgId: string, params: CreateTicketParams): Promise<Ticket> {
  const rows = await sql`
    INSERT INTO support_tickets (
      org_id, created_by_email, subject, description, priority, category,
      source, app_id, environment, tags
    ) VALUES (
      ${orgId},
      ${params.email},
      ${params.subject},
      ${params.description},
      ${params.priority || 'medium'},
      ${params.category || 'technical'},
      ${params.source || 'console'},
      ${params.appId || null},
      ${params.environment || null},
      ${sql.array(params.tags || [])}
    )
    RETURNING *
  `;

  // Increment usage (fire-and-forget)
  incrementTicketUsage(orgId).catch(() => {});

  return rows[0] as unknown as Ticket;
}

export async function createErrorTicket(orgId: string, params: CreateErrorTicketParams): Promise<{ ticket: Ticket; deduplicated: boolean }> {
  const errorStack = params.errorStack || params.errorMessage;
  const category = params.category || 'bug';
  const fingerprint = computeErrorFingerprint(errorStack, category);

  // Check for existing open ticket with same fingerprint
  const existing = await sql`
    SELECT id, subject FROM support_tickets
    WHERE org_id = ${orgId}
      AND error_fingerprint = ${fingerprint}
      AND status != 'closed'
    LIMIT 1
  `;

  if (existing.length > 0) {
    // Deduplicate: add a comment to the existing ticket instead
    const ticketId = existing[0].id;
    await sql`
      INSERT INTO support_comments (ticket_id, author_email, author_type, message)
      VALUES (
        ${ticketId},
        ${params.email || 'system'},
        'system',
        ${'Duplicate error occurrence detected:\n\n' + params.errorMessage + (params.errorStack ? '\n\n```\n' + params.errorStack.slice(0, 2000) + '\n```' : '')}
      )
    `;
    await sql`
      UPDATE support_tickets SET updated_at = now() WHERE id = ${ticketId}
    `;

    // Fetch the existing ticket to return
    const ticketRows = await sql`SELECT * FROM support_tickets WHERE id = ${ticketId}`;
    return { ticket: ticketRows[0] as unknown as Ticket, deduplicated: true };
  }

  // Create new error ticket
  const subject = `[Auto] ${params.errorMessage.slice(0, 120)}`;
  const description = params.errorMessage + (params.errorStack ? '\n\n```\n' + params.errorStack.slice(0, 4000) + '\n```' : '');

  const rows = await sql`
    INSERT INTO support_tickets (
      org_id, created_by_email, subject, description, priority, category,
      source, app_id, environment, tags,
      error_stack, error_context, error_fingerprint
    ) VALUES (
      ${orgId},
      ${params.email || 'system'},
      ${subject},
      ${description},
      'high',
      ${category},
      'auto-error',
      ${params.appId || null},
      ${params.environment || null},
      ${sql.array(params.tags || ['auto-error'])},
      ${params.errorStack || null},
      ${params.errorContext ? sql.json(params.errorContext as any) : null},
      ${fingerprint}
    )
    RETURNING *
  `;

  // Increment usage (fire-and-forget)
  incrementTicketUsage(orgId).catch(() => {});

  return { ticket: rows[0] as unknown as Ticket, deduplicated: false };
}

export async function listTickets(orgId: string, filters?: ListTicketFilters): Promise<{ tickets: Ticket[]; total: number }> {
  const conditions: string[] = ['t.org_id = $1'];
  const values: unknown[] = [orgId];
  let paramIdx = 2;

  if (filters?.status) {
    conditions.push(`t.status = $${paramIdx++}`);
    values.push(filters.status);
  }
  if (filters?.priority) {
    conditions.push(`t.priority = $${paramIdx++}`);
    values.push(filters.priority);
  }
  if (filters?.category) {
    conditions.push(`t.category = $${paramIdx++}`);
    values.push(filters.category);
  }
  if (filters?.appId) {
    conditions.push(`t.app_id = $${paramIdx++}`);
    values.push(filters.appId);
  }
  if (filters?.source) {
    conditions.push(`t.source = $${paramIdx++}`);
    values.push(filters.source);
  }
  if (filters?.tag) {
    conditions.push(`$${paramIdx++} = ANY(t.tags)`);
    values.push(filters.tag);
  }

  const where = conditions.join(' AND ');
  const limit = Math.min(filters?.limit || 20, 100);
  const offset = filters?.offset || 0;

  // Use raw SQL via unsafe for dynamic queries
  const countResult = await sql.unsafe(
    `SELECT COUNT(*)::int as total FROM support_tickets t WHERE ${where}`,
    values as any
  );

  const result = await sql.unsafe(`
    SELECT t.*, a.name as app_name, COUNT(c.id)::int as comment_count
    FROM support_tickets t
    LEFT JOIN apps a ON a.id = t.app_id
    LEFT JOIN support_comments c ON c.ticket_id = t.id
    WHERE ${where}
    GROUP BY t.id, a.name
    ORDER BY
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.updated_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `, [...values, limit, offset] as any);

  return {
    tickets: result as unknown as Ticket[],
    total: (countResult[0] as any)?.total || 0,
  };
}

export async function getTicket(orgId: string, ticketId: string): Promise<Ticket | null> {
  const rows = await sql`
    SELECT t.*, a.name as app_name, COUNT(c.id)::int as comment_count
    FROM support_tickets t
    LEFT JOIN apps a ON a.id = t.app_id
    LEFT JOIN support_comments c ON c.ticket_id = t.id
    WHERE t.id = ${ticketId} AND t.org_id = ${orgId}
    GROUP BY t.id, a.name
  `;
  return rows.length > 0 ? (rows[0] as unknown as Ticket) : null;
}

export async function updateTicket(orgId: string, ticketId: string, updates: UpdateTicketParams): Promise<Ticket | null> {
  const ticket = await getTicket(orgId, ticketId);
  if (!ticket) return null;

  const rows = await sql`
    UPDATE support_tickets SET
      status = ${updates.status || ticket.status},
      priority = ${updates.priority || ticket.priority},
      category = ${updates.category || ticket.category},
      assigned_to = ${updates.assigned_to !== undefined ? updates.assigned_to : ticket.assigned_to},
      tags = ${sql.array(updates.tags !== undefined ? updates.tags : ticket.tags)},
      updated_at = now()
    WHERE id = ${ticketId} AND org_id = ${orgId}
    RETURNING *
  `;

  return rows.length > 0 ? (rows[0] as unknown as Ticket) : null;
}

export async function addTicketComment(orgId: string, ticketId: string, input: {
  authorEmail: string;
  authorType: 'customer' | 'admin' | 'system';
  message: string;
}): Promise<TicketComment | null> {
  // Verify ticket belongs to org
  const ticket = await sql`
    SELECT id FROM support_tickets WHERE id = ${ticketId} AND org_id = ${orgId}
  `;
  if (ticket.length === 0) return null;

  const rows = await sql`
    INSERT INTO support_comments (ticket_id, author_email, author_type, message)
    VALUES (${ticketId}, ${input.authorEmail}, ${input.authorType}, ${input.message})
    RETURNING *
  `;

  // Update ticket timestamp
  await sql`UPDATE support_tickets SET updated_at = now() WHERE id = ${ticketId}`;

  return rows[0] as unknown as TicketComment;
}

export async function getTicketComments(orgId: string, ticketId: string): Promise<TicketComment[]> {
  // Verify ticket belongs to org
  const ticket = await sql`
    SELECT id FROM support_tickets WHERE id = ${ticketId} AND org_id = ${orgId}
  `;
  if (ticket.length === 0) return [];

  const rows = await sql`
    SELECT * FROM support_comments
    WHERE ticket_id = ${ticketId}
    ORDER BY created_at ASC
  `;
  return rows as unknown as TicketComment[];
}
