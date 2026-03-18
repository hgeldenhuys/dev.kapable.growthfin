/**
 * API Usage Notifications
 * Discord webhook alerts and email notifications for API usage thresholds
 */

import { db, apiUsageAlerts } from '@agios/db';
import type { ApiUsageAlert, ApiAlertLevel } from '@agios/db';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Discord
// ---------------------------------------------------------------------------

const DISCORD_COLORS: Record<ApiAlertLevel, number> = {
  info: 0x3498db,     // blue
  warning: 0xf39c12,  // yellow/orange
  critical: 0xe74c3c, // red
  depleted: 0x8b0000, // dark red
};

const LEVEL_EMOJI: Record<ApiAlertLevel, string> = {
  info: '\u2139\uFE0F',       // info
  warning: '\u26A0\uFE0F',    // warning
  critical: '\uD83D\uDED1',   // stop sign
  depleted: '\uD83D\uDCA5',   // collision
};

async function sendDiscordAlert(alert: ApiUsageAlert): Promise<boolean> {
  const webhookUrl = process.env['DISCORD_WEBHOOK_URL'];
  if (!webhookUrl) {
    console.warn('[API Usage Notifications] DISCORD_WEBHOOK_URL not configured, skipping Discord alert');
    return false;
  }

  try {
    const level = alert.alertLevel as ApiAlertLevel;
    const emoji = LEVEL_EMOJI[level] || '';
    const color = DISCORD_COLORS[level] || 0x95a5a6;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `${emoji} API Usage Alert: ${alert.provider}`,
            description: alert.message,
            color,
            fields: [
              { name: 'Provider', value: alert.provider, inline: true },
              { name: 'Level', value: alert.alertLevel.toUpperCase(), inline: true },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'NewLeads API Usage Monitor' },
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[API Usage Notifications] Discord webhook failed: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[API Usage Notifications] Discord webhook error:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Email (via Resend)
// ---------------------------------------------------------------------------

async function sendEmailAlert(alert: ApiUsageAlert): Promise<boolean> {
  // Only send emails for critical and depleted levels to avoid noise
  const level = alert.alertLevel as ApiAlertLevel;
  if (level !== 'critical' && level !== 'depleted') {
    return false;
  }

  try {
    // Lazy import to avoid circular dependencies and allow graceful failure
    const { getResendProvider } = await import('../../lib/providers/resend');
    const resend = getResendProvider();

    const adminEmail = process.env['ADMIN_ALERT_EMAIL'];
    if (!adminEmail) {
      console.warn('[API Usage Notifications] ADMIN_ALERT_EMAIL not configured, skipping email alert');
      return false;
    }

    const levelColor = level === 'depleted' ? '#8b0000' : '#e74c3c';

    await resend.sendEmail({
      to: adminEmail,
      subject: `[${level.toUpperCase()}] API Usage Alert: ${alert.provider}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${levelColor}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">API Usage Alert</h2>
          </div>
          <div style="padding: 16px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
            <p><strong>Provider:</strong> ${alert.provider}</p>
            <p><strong>Level:</strong> ${alert.alertLevel.toUpperCase()}</p>
            <p><strong>Message:</strong> ${alert.message}</p>
            <p style="color: #666; font-size: 12px; margin-top: 24px;">
              Sent by NewLeads API Usage Monitor at ${new Date().toISOString()}
            </p>
          </div>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('[API Usage Notifications] Email alert error:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send notifications (Discord + Email) for a list of alerts.
 * Updates the alert rows with notification status.
 */
export async function sendApiUsageNotifications(alerts: ApiUsageAlert[]): Promise<void> {
  for (const alert of alerts) {
    const [discordSent, emailSent] = await Promise.all([
      sendDiscordAlert(alert),
      sendEmailAlert(alert),
    ]);

    // Update alert with notification status
    await db
      .update(apiUsageAlerts)
      .set({
        discordSent,
        emailSent,
      })
      .where(eq(apiUsageAlerts.id, alert.id));

    console.log(
      `[API Usage Notifications] ${alert.provider} (${alert.alertLevel}): discord=${discordSent}, email=${emailSent}`
    );
  }
}
