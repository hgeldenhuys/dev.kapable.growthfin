/**
 * Email API - Platform Email Service for Connect Apps
 *
 * Endpoints:
 *   POST  /v1/email/send   - Send an email (quota + rate limit enforced)
 *   GET   /v1/email/usage  - Get current month usage + quota
 */

import type { AdminContext } from '../lib/admin-auth';
import { checkRateLimit, rateLimitResponse } from '../lib/rate-limit';
import { sendEmail, getEmailUsage } from '../services/email-service';

export async function handleEmailRoutes(
  req: Request,
  pathname: string,
  ctx: AdminContext
): Promise<Response | null> {

  // POST /v1/email/send
  if (pathname === '/v1/email/send' && req.method === 'POST') {
    // Rate limit: 10 emails per minute per org
    const rateKey = `email:${ctx.orgId}`;
    const rateResult = checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 10 });
    if (!rateResult.allowed) {
      return rateLimitResponse(rateResult);
    }

    let body: {
      to?: string | string[];
      subject?: string;
      html?: string;
      text?: string;
      replyTo?: string;
      from?: string;
      appId?: string;
    };

    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.to) {
      return Response.json({ error: 'to is required' }, { status: 400 });
    }
    if (!body.subject) {
      return Response.json({ error: 'subject is required' }, { status: 400 });
    }
    if (!body.html && !body.text) {
      return Response.json({ error: 'Either html or text body is required' }, { status: 400 });
    }

    const result = await sendEmail(
      {
        to: body.to,
        subject: body.subject,
        html: body.html,
        text: body.text,
        replyTo: body.replyTo,
        from: body.from,
      },
      {
        orgId: ctx.orgId,
        appId: body.appId,
        sentVia: 'api',
      }
    );

    if (!result.success) {
      const status = result.error?.includes('quota exceeded') ? 402 : 500;
      return Response.json({
        error: result.error,
        usage: result.usage,
      }, { status });
    }

    return Response.json({
      success: true,
      messageId: result.messageId,
      usage: result.usage,
    });
  }

  // GET /v1/email/usage
  if (pathname === '/v1/email/usage' && req.method === 'GET') {
    const usage = await getEmailUsage(ctx.orgId);
    return Response.json(usage);
  }

  return null;
}
