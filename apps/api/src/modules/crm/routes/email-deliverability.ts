/**
 * Email Deliverability & Compliance Routes (Phase P)
 * Manages email suppression list, unsubscribe handling, rate limits, and compliance settings
 */

import { Elysia, t } from 'elysia';
import { db, workspaces, type WorkspaceSettings } from '@agios/db';
import { eq } from 'drizzle-orm';
import { EmailSuppressionService } from '../services/email-suppression.service';
import { EmailRateLimitService } from '../services/email-rate-limit.service';

// ============================================================================
// UNSUBSCRIBE ROUTES (Public - no auth required)
// ============================================================================

export const emailUnsubscribeRoutes = new Elysia({ prefix: '/email' })

  /**
   * GET /email/unsubscribe
   * One-click unsubscribe endpoint (linked from email footer)
   * Returns a simple confirmation page
   */
  .get('/unsubscribe', async ({ query, set }) => {
    const { token } = query;

    if (!token) {
      set.status = 400;
      return generateUnsubscribePage('Invalid Request', 'Missing unsubscribe token.', false);
    }

    const parsed = EmailSuppressionService.parseUnsubscribeToken(token);
    if (!parsed) {
      set.status = 400;
      return generateUnsubscribePage('Invalid Request', 'Invalid or expired unsubscribe token.', false);
    }

    try {
      await EmailSuppressionService.handleUnsubscribe({
        workspaceId: parsed.workspaceId,
        email: parsed.email,
        campaignId: parsed.campaignId,
      });

      set.headers['content-type'] = 'text/html';
      return generateUnsubscribePage(
        'Unsubscribed Successfully',
        `${parsed.email} has been unsubscribed from future emails.`,
        true
      );
    } catch (error) {
      console.error('[Unsubscribe] Error processing unsubscribe:', error);
      set.status = 500;
      return generateUnsubscribePage('Error', 'An error occurred. Please try again.', false);
    }
  }, {
    query: t.Object({
      token: t.String({ description: 'Unsubscribe token from email link' }),
    }),
    detail: {
      tags: ['Email', 'Unsubscribe'],
      summary: 'One-click email unsubscribe',
      description: 'Processes one-click unsubscribe requests from email footer links.',
    },
  })

  /**
   * POST /email/unsubscribe
   * RFC 8058 one-click unsubscribe (List-Unsubscribe-Post header support)
   */
  .post('/unsubscribe', async ({ query, set }) => {
    const { token } = query;

    if (!token) {
      set.status = 400;
      return { error: 'Missing unsubscribe token' };
    }

    const parsed = EmailSuppressionService.parseUnsubscribeToken(token);
    if (!parsed) {
      set.status = 400;
      return { error: 'Invalid token' };
    }

    try {
      await EmailSuppressionService.handleUnsubscribe({
        workspaceId: parsed.workspaceId,
        email: parsed.email,
        campaignId: parsed.campaignId,
      });

      return { success: true, email: parsed.email };
    } catch (error) {
      console.error('[Unsubscribe] Error processing unsubscribe:', error);
      set.status = 500;
      return { error: 'Failed to process unsubscribe' };
    }
  }, {
    query: t.Object({
      token: t.String({ description: 'Unsubscribe token from List-Unsubscribe header' }),
    }),
    detail: {
      tags: ['Email', 'Unsubscribe'],
      summary: 'RFC 8058 one-click unsubscribe (POST)',
      description: 'Handles List-Unsubscribe-Post requests from email clients.',
    },
  });

// ============================================================================
// SUPPRESSION LIST ROUTES (Authenticated)
// ============================================================================

export const emailSuppressionRoutes = new Elysia({ prefix: '/workspaces' })

  /**
   * GET /workspaces/:workspaceId/email-suppressions
   * List suppressed emails with pagination and filtering
   */
  .get('/:workspaceId/email-suppressions', async ({ params, query, set }) => {
    const { workspaceId } = params;

    try {
      const result = await EmailSuppressionService.list({
        workspaceId,
        activeOnly: query.activeOnly !== 'false',
        reason: query.reason as any,
        limit: query.limit ? parseInt(query.limit) : 50,
        offset: query.offset ? parseInt(query.offset) : 0,
      });

      return result;
    } catch (error) {
      console.error('[Email Suppression] Error listing suppressions:', error);
      set.status = 500;
      return { error: 'Failed to fetch suppression list' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    query: t.Object({
      activeOnly: t.Optional(t.String({ description: 'Filter by active status (default: true)' })),
      reason: t.Optional(t.String({ description: 'Filter by reason: hard_bounce|soft_bounce_converted|spam_complaint|manual_unsubscribe|admin_suppressed' })),
      limit: t.Optional(t.String({ description: 'Page size (default: 50)' })),
      offset: t.Optional(t.String({ description: 'Offset (default: 0)' })),
    }),
    detail: {
      tags: ['Email', 'Suppression'],
      summary: 'List suppressed emails',
      description: 'Returns a paginated list of suppressed email addresses for a workspace.',
    },
  })

  /**
   * GET /workspaces/:workspaceId/email-suppressions/stats
   * Get suppression statistics
   */
  .get('/:workspaceId/email-suppressions/stats', async ({ params, set }) => {
    const { workspaceId } = params;

    try {
      const stats = await EmailSuppressionService.getStats(workspaceId);
      return stats;
    } catch (error) {
      console.error('[Email Suppression] Error fetching stats:', error);
      set.status = 500;
      return { error: 'Failed to fetch suppression stats' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    detail: {
      tags: ['Email', 'Suppression'],
      summary: 'Get suppression statistics',
      description: 'Returns suppression counts grouped by reason.',
    },
  })

  /**
   * POST /workspaces/:workspaceId/email-suppressions
   * Manually suppress an email address
   */
  .post('/:workspaceId/email-suppressions', async ({ params, body, set }) => {
    const { workspaceId } = params;

    try {
      await EmailSuppressionService.suppress({
        workspaceId,
        email: body.email,
        reason: 'admin_suppressed',
        reasonDetail: body.reason || 'Manually suppressed by admin',
        sourceType: 'admin',
      });

      return { success: true, email: body.email.toLowerCase().trim() };
    } catch (error) {
      console.error('[Email Suppression] Error adding suppression:', error);
      set.status = 500;
      return { error: 'Failed to suppress email' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    body: t.Object({
      email: t.String({ format: 'email', description: 'Email address to suppress' }),
      reason: t.Optional(t.String({ description: 'Optional reason for suppression' })),
    }),
    detail: {
      tags: ['Email', 'Suppression'],
      summary: 'Manually suppress an email',
      description: 'Adds an email address to the suppression list.',
    },
  })

  /**
   * POST /workspaces/:workspaceId/email-suppressions/bulk
   * Bulk suppress email addresses (e.g., from import)
   */
  .post('/:workspaceId/email-suppressions/bulk', async ({ params, body, set }) => {
    const { workspaceId } = params;

    try {
      let count = 0;
      for (const email of body.emails) {
        await EmailSuppressionService.suppress({
          workspaceId,
          email,
          reason: 'admin_suppressed',
          reasonDetail: body.reason || 'Bulk suppression by admin',
          sourceType: body.source === 'import' ? 'import' : 'admin',
        });
        count++;
      }

      return { success: true, suppressedCount: count };
    } catch (error) {
      console.error('[Email Suppression] Error bulk suppressing:', error);
      set.status = 500;
      return { error: 'Failed to bulk suppress emails' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    body: t.Object({
      emails: t.Array(t.String({ format: 'email' }), { description: 'Email addresses to suppress' }),
      reason: t.Optional(t.String({ description: 'Reason for suppression' })),
      source: t.Optional(t.String({ description: 'Source: admin or import' })),
    }),
    detail: {
      tags: ['Email', 'Suppression'],
      summary: 'Bulk suppress emails',
      description: 'Adds multiple email addresses to the suppression list.',
    },
  })

  /**
   * DELETE /workspaces/:workspaceId/email-suppressions/:email
   * Reactivate (un-suppress) an email address
   */
  .delete('/:workspaceId/email-suppressions/:email', async ({ params, set }) => {
    const { workspaceId, email } = params;

    try {
      const reactivated = await EmailSuppressionService.reactivate({
        workspaceId,
        email: decodeURIComponent(email),
      });

      if (!reactivated) {
        set.status = 404;
        return { error: 'Suppression not found or already inactive' };
      }

      return { success: true, email: decodeURIComponent(email) };
    } catch (error) {
      console.error('[Email Suppression] Error reactivating:', error);
      set.status = 500;
      return { error: 'Failed to reactivate email' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
      email: t.String({ description: 'URL-encoded email address to reactivate' }),
    }),
    detail: {
      tags: ['Email', 'Suppression'],
      summary: 'Reactivate suppressed email',
      description: 'Removes an email from the active suppression list.',
    },
  })

  /**
   * POST /workspaces/:workspaceId/email-suppressions/check
   * Check if an email is suppressed (useful for forms/imports)
   */
  .post('/:workspaceId/email-suppressions/check', async ({ params, body, set }) => {
    const { workspaceId } = params;

    try {
      const isSuppressed = await EmailSuppressionService.isSuppressed(workspaceId, body.email);
      return { email: body.email, suppressed: isSuppressed };
    } catch (error) {
      console.error('[Email Suppression] Error checking suppression:', error);
      set.status = 500;
      return { error: 'Failed to check suppression' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    body: t.Object({
      email: t.String({ format: 'email', description: 'Email address to check' }),
    }),
    detail: {
      tags: ['Email', 'Suppression'],
      summary: 'Check if email is suppressed',
      description: 'Checks whether an email address is on the suppression list.',
    },
  });

// ============================================================================
// EMAIL RATE LIMIT ROUTES
// ============================================================================

export const emailRateLimitRoutes = new Elysia({ prefix: '/workspaces' })

  /**
   * GET /workspaces/:workspaceId/email-rate-limit
   * Get current email rate limit settings and usage
   */
  .get('/:workspaceId/email-rate-limit', async ({ params, set }) => {
    const { workspaceId } = params;

    try {
      const workspace = await db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspace[0]) {
        set.status = 404;
        return { error: 'Workspace not found' };
      }

      const usageStats = await EmailRateLimitService.getUsageStats(workspaceId);

      return {
        settings: usageStats.settings,
        usage: {
          minute: { ...usageStats.usage.minute, resetAt: usageStats.usage.minute.resetAt.toISOString() },
          hour: { ...usageStats.usage.hour, resetAt: usageStats.usage.hour.resetAt.toISOString() },
          day: { ...usageStats.usage.day, resetAt: usageStats.usage.day.resetAt.toISOString() },
        },
      };
    } catch (error) {
      console.error('[Email Rate Limit] Error fetching settings:', error);
      set.status = 500;
      return { error: 'Failed to fetch email rate limit settings' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    detail: {
      tags: ['Email', 'Rate Limit'],
      summary: 'Get email rate limit settings and usage',
      description: 'Returns the email rate limit configuration and current usage statistics.',
    },
  })

  /**
   * PUT /workspaces/:workspaceId/email-rate-limit
   * Update email rate limit settings
   */
  .put('/:workspaceId/email-rate-limit', async ({ params, body, set }) => {
    const { workspaceId } = params;

    try {
      const workspace = await db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspace[0]) {
        set.status = 404;
        return { error: 'Workspace not found' };
      }

      const currentSettings = (workspace[0].settings || {}) as WorkspaceSettings;

      const updatedSettings: WorkspaceSettings = {
        ...currentSettings,
        emailRateLimit: {
          enabled: body.enabled,
          emailsPerMinute: body.emailsPerMinute ?? 100,
          emailsPerHour: body.emailsPerHour ?? 5000,
          emailsPerDay: body.emailsPerDay ?? 50000,
          batchSize: body.batchSize ?? 100,
          batchDelayMs: body.batchDelayMs ?? 500,
        },
      };

      await db
        .update(workspaces)
        .set({ settings: updatedSettings, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));

      return { success: true, settings: updatedSettings.emailRateLimit };
    } catch (error) {
      console.error('[Email Rate Limit] Error updating settings:', error);
      set.status = 500;
      return { error: 'Failed to update email rate limit settings' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    body: t.Object({
      enabled: t.Boolean({ description: 'Enable email rate limiting' }),
      emailsPerMinute: t.Optional(t.Number({ minimum: 1, description: 'Max emails per minute' })),
      emailsPerHour: t.Optional(t.Number({ minimum: 1, description: 'Max emails per hour' })),
      emailsPerDay: t.Optional(t.Number({ minimum: 1, description: 'Max emails per day' })),
      batchSize: t.Optional(t.Number({ minimum: 1, description: 'Emails per batch' })),
      batchDelayMs: t.Optional(t.Number({ minimum: 100, description: 'Delay between batches (ms)' })),
    }),
    detail: {
      tags: ['Email', 'Rate Limit'],
      summary: 'Update email rate limit settings',
      description: 'Updates the email rate limit configuration for a workspace.',
    },
  });

// ============================================================================
// EMAIL COMPLIANCE SETTINGS ROUTES
// ============================================================================

export const emailComplianceRoutes = new Elysia({ prefix: '/workspaces' })

  /**
   * GET /workspaces/:workspaceId/email-compliance
   * Get email compliance settings
   */
  .get('/:workspaceId/email-compliance', async ({ params, set }) => {
    const { workspaceId } = params;

    try {
      const settings = await EmailSuppressionService.getComplianceSettings(workspaceId);
      return settings;
    } catch (error) {
      console.error('[Email Compliance] Error fetching settings:', error);
      set.status = 500;
      return { error: 'Failed to fetch compliance settings' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    detail: {
      tags: ['Email', 'Compliance'],
      summary: 'Get email compliance settings',
      description: 'Returns CAN-SPAM/GDPR compliance configuration.',
    },
  })

  /**
   * PUT /workspaces/:workspaceId/email-compliance
   * Update email compliance settings
   */
  .put('/:workspaceId/email-compliance', async ({ params, body, set }) => {
    const { workspaceId } = params;

    try {
      const workspace = await db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspace[0]) {
        set.status = 404;
        return { error: 'Workspace not found' };
      }

      const currentSettings = (workspace[0].settings || {}) as WorkspaceSettings;

      const updatedSettings: WorkspaceSettings = {
        ...currentSettings,
        emailCompliance: {
          physicalAddress: body.physicalAddress,
          companyName: body.companyName,
          softBounceThreshold: body.softBounceThreshold ?? 3,
          autoSuppressOnComplaint: body.autoSuppressOnComplaint ?? true,
          autoSuppressOnHardBounce: body.autoSuppressOnHardBounce ?? true,
        },
      };

      await db
        .update(workspaces)
        .set({ settings: updatedSettings, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));

      return { success: true, settings: updatedSettings.emailCompliance };
    } catch (error) {
      console.error('[Email Compliance] Error updating settings:', error);
      set.status = 500;
      return { error: 'Failed to update compliance settings' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    body: t.Object({
      physicalAddress: t.Optional(t.String({ description: 'Physical mailing address (CAN-SPAM)' })),
      companyName: t.Optional(t.String({ description: 'Company name for email footer' })),
      softBounceThreshold: t.Optional(t.Number({ minimum: 1, maximum: 10, description: 'Soft bounces before hard suppression (1-10)' })),
      autoSuppressOnComplaint: t.Optional(t.Boolean({ description: 'Auto-suppress on spam complaint' })),
      autoSuppressOnHardBounce: t.Optional(t.Boolean({ description: 'Auto-suppress on hard bounce' })),
    }),
    detail: {
      tags: ['Email', 'Compliance'],
      summary: 'Update email compliance settings',
      description: 'Updates CAN-SPAM/GDPR compliance configuration.',
    },
  });

// ============================================================================
// HELPER: Generate unsubscribe HTML page
// ============================================================================

function generateUnsubscribePage(title: string, message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 440px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: #111827; margin: 0 0 12px; font-size: 24px; }
    p { color: #6b7280; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '&#9989;' : '&#10060;'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
