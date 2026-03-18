/**
 * Tickets API — Platform Ticketing Service for Connect Apps
 *
 * Endpoints:
 *   GET    /v1/tickets              - List tickets (with filters)
 *   POST   /v1/tickets              - Create ticket
 *   POST   /v1/tickets/error        - Auto-create from error (deduplicates)
 *   GET    /v1/tickets/usage        - Monthly usage + quota
 *   GET    /v1/tickets/:id          - Get ticket + comment count
 *   PUT    /v1/tickets/:id          - Update ticket
 *   GET    /v1/tickets/:id/comments - List comments
 *   POST   /v1/tickets/:id/comments - Add comment
 */

import type { AdminContext } from '../lib/admin-auth';
import { checkRateLimit, rateLimitResponse } from '../lib/rate-limit';
import {
  createTicket,
  createErrorTicket,
  listTickets,
  getTicket,
  updateTicket,
  addTicketComment,
  getTicketComments,
  getTicketUsage,
  checkTicketQuota,
} from '../services/tickets-service';

export async function handleTicketRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {

  // Rate limit: 30 req/min per org
  const rateKey = `tickets:${ctx.orgId}`;
  const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 30 });
  if (!rateResult.allowed) {
    return rateLimitResponse(rateResult);
  }

  const url = new URL(req.url);

  // POST /v1/tickets/error — Auto-create from error (deduplicates)
  if (pathname === '/v1/tickets/error' && req.method === 'POST') {
    let body: {
      errorMessage?: string;
      errorStack?: string;
      errorContext?: Record<string, unknown>;
      email?: string;
      category?: string;
      appId?: string;
      environment?: string;
      tags?: string[];
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.errorMessage) {
      return Response.json({ error: 'errorMessage is required' }, { status: 400 });
    }

    // Quota check
    const { allowed, usage } = await checkTicketQuota(ctx.orgId);
    if (!allowed) {
      return Response.json({
        error: `Monthly ticket quota exceeded (${usage.tickets_created}/${usage.quota})`,
        usage,
      }, { status: 402 });
    }

    const result = await createErrorTicket(ctx.orgId, {
      errorMessage: body.errorMessage,
      errorStack: body.errorStack,
      errorContext: body.errorContext,
      email: body.email,
      category: body.category,
      appId: body.appId,
      environment: body.environment,
      tags: body.tags,
    });

    return Response.json(result, { status: result.deduplicated ? 200 : 201 });
  }

  // GET /v1/tickets/usage — Monthly usage
  if (pathname === '/v1/tickets/usage' && req.method === 'GET') {
    const usage = await getTicketUsage(ctx.orgId);
    return Response.json(usage);
  }

  // GET /v1/tickets — List with filters
  if (pathname === '/v1/tickets' && req.method === 'GET') {
    const filters = {
      status: url.searchParams.get('status') || undefined,
      priority: url.searchParams.get('priority') || undefined,
      category: url.searchParams.get('category') || undefined,
      appId: url.searchParams.get('app_id') || undefined,
      source: url.searchParams.get('source') || undefined,
      tag: url.searchParams.get('tag') || undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined,
    };

    const result = await listTickets(ctx.orgId, filters);
    return Response.json(result);
  }

  // POST /v1/tickets — Create ticket
  if (pathname === '/v1/tickets' && req.method === 'POST') {
    let body: {
      subject?: string;
      description?: string;
      email?: string;
      priority?: string;
      category?: string;
      source?: string;
      appId?: string;
      environment?: string;
      tags?: string[];
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.subject || !body.description) {
      return Response.json({ error: 'subject and description are required' }, { status: 400 });
    }

    // Quota check
    const { allowed, usage } = await checkTicketQuota(ctx.orgId);
    if (!allowed) {
      return Response.json({
        error: `Monthly ticket quota exceeded (${usage.tickets_created}/${usage.quota})`,
        usage,
      }, { status: 402 });
    }

    const ticket = await createTicket(ctx.orgId, {
      email: body.email || 'api',
      subject: body.subject,
      description: body.description,
      priority: body.priority,
      category: body.category,
      source: body.source || 'api',
      appId: body.appId,
      environment: body.environment,
      tags: body.tags,
    });

    return Response.json(ticket, { status: 201 });
  }

  // Match /v1/tickets/:id/comments
  const commentsMatch = pathname.match(/^\/v1\/tickets\/([0-9a-f-]+)\/comments$/);
  if (commentsMatch) {
    const ticketId = commentsMatch[1];

    // GET /v1/tickets/:id/comments
    if (req.method === 'GET') {
      const comments = await getTicketComments(ctx.orgId, ticketId);
      return Response.json({ comments });
    }

    // POST /v1/tickets/:id/comments
    if (req.method === 'POST') {
      let body: {
        message?: string;
        authorEmail?: string;
        authorType?: 'customer' | 'admin' | 'system';
      };

      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      if (!body.message) {
        return Response.json({ error: 'message is required' }, { status: 400 });
      }

      const comment = await addTicketComment(ctx.orgId, ticketId, {
        authorEmail: body.authorEmail || 'api',
        authorType: body.authorType || 'customer',
        message: body.message,
      });

      if (!comment) {
        return Response.json({ error: 'Ticket not found' }, { status: 404 });
      }

      return Response.json(comment, { status: 201 });
    }
  }

  // Match /v1/tickets/:id
  const idMatch = pathname.match(/^\/v1\/tickets\/([0-9a-f-]+)$/);
  if (idMatch) {
    const ticketId = idMatch[1];

    // GET /v1/tickets/:id
    if (req.method === 'GET') {
      const ticket = await getTicket(ctx.orgId, ticketId);
      if (!ticket) {
        return Response.json({ error: 'Ticket not found' }, { status: 404 });
      }
      return Response.json(ticket);
    }

    // PUT /v1/tickets/:id
    if (req.method === 'PUT') {
      let body: {
        status?: string;
        priority?: string;
        category?: string;
        assigned_to?: string | null;
        tags?: string[];
      };

      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const updated = await updateTicket(ctx.orgId, ticketId, {
        status: body.status,
        priority: body.priority,
        category: body.category,
        assigned_to: body.assigned_to,
        tags: body.tags,
      });

      if (!updated) {
        return Response.json({ error: 'Ticket not found' }, { status: 404 });
      }

      return Response.json(updated);
    }
  }

  return null;
}
