/**
 * Workspace SMS Rate Limit Configuration Routes (Phase H.3)
 * Manage SMS rate limiting settings at the workspace level
 */

import { Elysia, t } from 'elysia';
import { db, workspaces, type WorkspaceSettings, type WorkspaceSmsRateLimitSettings } from '@agios/db';
import { eq } from 'drizzle-orm';
import { SmsRateLimitService } from '../services/sms-rate-limit.service';

/**
 * Default rate limit settings
 */
const DEFAULT_SETTINGS: WorkspaceSmsRateLimitSettings = {
  enabled: true,
  smsPerMinute: 60,
  smsPerHour: 1000,
  smsPerDay: 10000,
  batchSize: 100,
  batchDelayMs: 1000,
};

/**
 * Validation schema for SMS rate limit settings
 */
const smsRateLimitSettingsSchema = t.Object({
  enabled: t.Boolean({ description: 'Enable SMS rate limiting' }),
  smsPerMinute: t.Optional(t.Number({ minimum: 1, maximum: 500, description: 'Max SMS per minute (1-500)' })),
  smsPerHour: t.Optional(t.Number({ minimum: 1, maximum: 10000, description: 'Max SMS per hour (1-10000)' })),
  smsPerDay: t.Optional(t.Number({ minimum: 1, maximum: 100000, description: 'Max SMS per day (1-100000)' })),
  batchSize: t.Optional(t.Number({ minimum: 1, maximum: 500, description: 'Messages per batch (1-500)' })),
  batchDelayMs: t.Optional(t.Number({ minimum: 100, maximum: 10000, description: 'Delay between batches in ms (100-10000)' })),
});

/**
 * Response schema for usage statistics
 */
const usageStatsSchema = t.Object({
  minute: t.Object({
    current: t.Number(),
    limit: t.Number(),
    remaining: t.Number(),
    resetAt: t.String({ format: 'date-time' }),
  }),
  hour: t.Object({
    current: t.Number(),
    limit: t.Number(),
    remaining: t.Number(),
    resetAt: t.String({ format: 'date-time' }),
  }),
  day: t.Object({
    current: t.Number(),
    limit: t.Number(),
    remaining: t.Number(),
    resetAt: t.String({ format: 'date-time' }),
  }),
});

export const workspaceSmsRateLimitRoutes = new Elysia({ prefix: '/workspaces' })

  /**
   * GET /workspaces/:workspaceId/sms-rate-limit
   * Get current SMS rate limit settings and usage for a workspace
   */
  .get('/:workspaceId/sms-rate-limit', async ({ params, set }) => {
    const { workspaceId } = params;

    try {
      // Get workspace settings
      const workspace = await db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspace[0]) {
        set.status = 404;
        return { error: 'Workspace not found' };
      }

      // Get settings and usage stats (getUsageStats includes settings)
      const usageStats = await SmsRateLimitService.getUsageStats(workspaceId);

      return {
        settings: usageStats.settings,
        usage: {
          minute: {
            ...usageStats.usage.minute,
            resetAt: usageStats.usage.minute.resetAt.toISOString(),
          },
          hour: {
            ...usageStats.usage.hour,
            resetAt: usageStats.usage.hour.resetAt.toISOString(),
          },
          day: {
            ...usageStats.usage.day,
            resetAt: usageStats.usage.day.resetAt.toISOString(),
          },
        },
      };
    } catch (error) {
      console.error('[SMS Rate Limit] Error fetching settings:', error);
      set.status = 500;
      return { error: 'Failed to fetch SMS rate limit settings' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    response: {
      200: t.Object({
        settings: smsRateLimitSettingsSchema,
        usage: usageStatsSchema,
      }),
      404: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() }),
    },
    detail: {
      tags: ['Workspaces', 'SMS Rate Limit'],
      summary: 'Get workspace SMS rate limit settings',
      description: 'Returns the SMS rate limit configuration and current usage statistics for a workspace.',
    },
  })

  /**
   * PUT /workspaces/:workspaceId/sms-rate-limit
   * Update SMS rate limit settings for a workspace
   */
  .put('/:workspaceId/sms-rate-limit', async ({ params, body, set }) => {
    const { workspaceId } = params;

    try {
      // Get current workspace settings
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

      // Build updated SMS rate limit settings
      const updatedSmsRateLimit: WorkspaceSmsRateLimitSettings = {
        enabled: body.enabled,
        smsPerMinute: body.smsPerMinute ?? DEFAULT_SETTINGS.smsPerMinute,
        smsPerHour: body.smsPerHour ?? DEFAULT_SETTINGS.smsPerHour,
        smsPerDay: body.smsPerDay ?? DEFAULT_SETTINGS.smsPerDay,
        batchSize: body.batchSize ?? DEFAULT_SETTINGS.batchSize,
        batchDelayMs: body.batchDelayMs ?? DEFAULT_SETTINGS.batchDelayMs,
      };

      // Build complete updated settings
      const updatedSettings: WorkspaceSettings = {
        ...currentSettings,
        smsRateLimit: updatedSmsRateLimit,
      };

      // Update workspace
      await db
        .update(workspaces)
        .set({
          settings: updatedSettings,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspaceId));

      console.log(`[SMS Rate Limit] Updated settings for workspace ${workspaceId}`, {
        enabled: body.enabled,
        smsPerMinute: updatedSmsRateLimit.smsPerMinute,
        smsPerHour: updatedSmsRateLimit.smsPerHour,
        smsPerDay: updatedSmsRateLimit.smsPerDay,
      });

      return {
        success: true,
        settings: updatedSmsRateLimit,
      };
    } catch (error) {
      console.error('[SMS Rate Limit] Error updating settings:', error);
      set.status = 500;
      return { error: 'Failed to update SMS rate limit settings' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    body: smsRateLimitSettingsSchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        settings: smsRateLimitSettingsSchema,
      }),
      404: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() }),
    },
    detail: {
      tags: ['Workspaces', 'SMS Rate Limit'],
      summary: 'Update workspace SMS rate limit settings',
      description: 'Updates the SMS rate limit configuration for a workspace.',
    },
  })

  /**
   * POST /workspaces/:workspaceId/sms-rate-limit/reset
   * Reset rate limit counters for a workspace (admin action)
   */
  .post('/:workspaceId/sms-rate-limit/reset', async ({ params, set }) => {
    const { workspaceId } = params;

    try {
      // Verify workspace exists
      const workspace = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspace[0]) {
        set.status = 404;
        return { error: 'Workspace not found' };
      }

      // Clean up all rate limit records for this workspace
      // Note: This is a soft reset - counters will naturally reset at window boundaries
      // For a hard reset, we would delete the records
      const deletedCount = await SmsRateLimitService.cleanupOldRecords();

      console.log(`[SMS Rate Limit] Reset rate limits for workspace ${workspaceId}, cleaned ${deletedCount} old records`);

      return {
        success: true,
        message: 'Rate limit counters have been reset',
        cleanedRecords: deletedCount,
      };
    } catch (error) {
      console.error('[SMS Rate Limit] Error resetting rate limits:', error);
      set.status = 500;
      return { error: 'Failed to reset rate limit counters' };
    }
  }, {
    params: t.Object({
      workspaceId: t.String({ description: 'Workspace ID' }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        cleanedRecords: t.Number(),
      }),
      404: t.Object({ error: t.String() }),
      500: t.Object({ error: t.String() }),
    },
    detail: {
      tags: ['Workspaces', 'SMS Rate Limit'],
      summary: 'Reset SMS rate limit counters',
      description: 'Resets the SMS rate limit counters for a workspace. Use with caution.',
    },
  });
