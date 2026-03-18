/**
 * Platform Email Service
 *
 * Provides email sending for Connect apps with per-org quota tracking.
 * Uses Resend for delivery, same RESEND_API_KEY as alerting.
 */

import { Resend } from 'resend';
import { sql } from '../lib/db';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM_PLATFORM || 'SignalDB <noreply@signaldb.live>';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  from?: string;
}

export interface EmailContext {
  orgId: string;
  appId?: string;
  sentVia?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  usage: EmailUsageStats;
}

export interface EmailUsageStats {
  sent: number;
  quota: number;
  remaining: number;
  month: string;
}

// ─── Quota ──────────────────────────────────────────────────────────────────

/**
 * Get the email monthly limit for an org based on their billing plan.
 * 0 = unlimited (enterprise).
 */
async function getEmailQuotaLimit(orgId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(
      (bp.limits->>'email_monthly_limit')::int,
      100
    ) as email_limit
    FROM org_subscriptions os
    JOIN billing_plans bp ON bp.id = os.plan_id
    WHERE os.org_id = ${orgId}
  `;
  return rows.length > 0 ? Number(rows[0].email_limit) : 100;
}

/**
 * Get current month's email usage for an org.
 */
export async function getEmailUsage(orgId: string): Promise<EmailUsageStats> {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const monthStr = currentMonth.toISOString().slice(0, 10);

  const [usageRows, quota] = await Promise.all([
    sql`
      SELECT emails_sent FROM email_usage
      WHERE organization_id = ${orgId} AND month = ${monthStr}
    `,
    getEmailQuotaLimit(orgId),
  ]);

  const sent = usageRows.length > 0 ? Number(usageRows[0].emails_sent) : 0;
  const remaining = quota === 0 ? Infinity : Math.max(0, quota - sent);

  return {
    sent,
    quota,
    remaining: quota === 0 ? -1 : remaining, // -1 = unlimited
    month: monthStr,
  };
}

/**
 * Check if an org can send more emails this month.
 */
export async function checkEmailQuota(orgId: string): Promise<{ allowed: boolean; usage: EmailUsageStats }> {
  const usage = await getEmailUsage(orgId);
  // quota 0 = unlimited
  const allowed = usage.quota === 0 || usage.sent < usage.quota;
  return { allowed, usage };
}

// ─── Send ───────────────────────────────────────────────────────────────────

/**
 * Send an email via Resend with quota enforcement and logging.
 */
export async function sendEmail(params: SendEmailParams, context: EmailContext): Promise<SendEmailResult> {
  if (!resend) {
    return {
      success: false,
      error: 'Email service not configured (RESEND_API_KEY missing)',
      usage: await getEmailUsage(context.orgId),
    };
  }

  // Check quota
  const { allowed, usage } = await checkEmailQuota(context.orgId);
  if (!allowed) {
    // Log the quota exceeded attempt
    logEmail(context, params, 'quota_exceeded', null, 'Monthly email quota exceeded').catch(() => {});
    return {
      success: false,
      error: `Monthly email quota exceeded (${usage.sent}/${usage.quota})`,
      usage,
    };
  }

  // Validate required fields
  if (!params.to || !params.subject) {
    return {
      success: false,
      error: 'to and subject are required',
      usage,
    };
  }

  if (!params.html && !params.text) {
    return {
      success: false,
      error: 'Either html or text body is required',
      usage,
    };
  }

  // Send via Resend
  try {
    const emailPayload: Record<string, unknown> = {
      from: params.from || EMAIL_FROM,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
    };
    if (params.html) emailPayload.html = params.html;
    if (params.text) emailPayload.text = params.text;
    if (params.replyTo) emailPayload.replyTo = [params.replyTo];

    const result = await resend.emails.send(emailPayload as any);

    if (result.error) {
      logEmail(context, params, 'failed', null, result.error.message).catch(() => {});
      return {
        success: false,
        error: result.error.message,
        usage: await getEmailUsage(context.orgId),
      };
    }

    // Increment usage atomically
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthStr = currentMonth.toISOString().slice(0, 10);

    await sql`
      INSERT INTO email_usage (organization_id, month, emails_sent, updated_at)
      VALUES (${context.orgId}, ${monthStr}, 1, now())
      ON CONFLICT (organization_id, month)
      DO UPDATE SET emails_sent = email_usage.emails_sent + 1, updated_at = now()
    `;

    // Log success (fire-and-forget)
    logEmail(context, params, 'sent', result.data?.id || null, null).catch(() => {});

    const updatedUsage = await getEmailUsage(context.orgId);
    return {
      success: true,
      messageId: result.data?.id,
      usage: updatedUsage,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logEmail(context, params, 'failed', null, errorMsg).catch(() => {});
    return {
      success: false,
      error: errorMsg,
      usage: await getEmailUsage(context.orgId),
    };
  }
}

// ─── Logging ────────────────────────────────────────────────────────────────

async function logEmail(
  context: EmailContext,
  params: SendEmailParams,
  status: string,
  providerId: string | null,
  errorMessage: string | null
): Promise<void> {
  const recipient = Array.isArray(params.to) ? params.to.join(', ') : params.to;
  await sql`
    INSERT INTO email_logs (organization_id, app_id, recipient, subject, from_address, status, provider_id, error_message, sent_via)
    VALUES (
      ${context.orgId},
      ${context.appId || null},
      ${recipient},
      ${params.subject},
      ${params.from || EMAIL_FROM},
      ${status},
      ${providerId},
      ${errorMessage},
      ${context.sentVia || 'api'}
    )
  `;
}
