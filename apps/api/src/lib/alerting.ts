/**
 * Alert Manager
 *
 * Sends alerts via email (Resend) and records them in the alert_history table.
 * Includes cooldown to prevent alert storms.
 */

import { Resend } from 'resend';
import { sql } from './db';
import { logger } from './logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'alerts@signaldb.live';
const EMAIL_FROM = process.env.EMAIL_FROM || 'SignalDB Alerts <alerts@signaldb.live>';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Cooldown: 15 minutes per alert type to avoid storms
const COOLDOWN_MS = 15 * 60 * 1000;
const lastAlertTimes = new Map<string, number>();

interface AlertOptions {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  serviceName?: string;
  message: string;
}

/**
 * Send an alert: record in DB + send email if not in cooldown
 */
export async function sendAlert(opts: AlertOptions): Promise<boolean> {
  const cooldownKey = `${opts.type}:${opts.serviceName || 'global'}`;
  const now = Date.now();
  const lastSent = lastAlertTimes.get(cooldownKey) || 0;

  // Check cooldown
  if (now - lastSent < COOLDOWN_MS) {
    return false; // Still in cooldown
  }

  lastAlertTimes.set(cooldownKey, now);

  // Record in DB
  try {
    await sql`
      INSERT INTO alert_history (alert_type, severity, service_name, message)
      VALUES (${opts.type}, ${opts.severity}, ${opts.serviceName || null}, ${opts.message})
    `;
  } catch (err) {
    logger.error('[alerting] Failed to record alert in DB', err instanceof Error ? err : new Error(String(err)));
  }

  // Send email
  if (resend) {
    try {
      const severityEmoji = opts.severity === 'critical' ? '[CRITICAL]' : opts.severity === 'warning' ? '[WARNING]' : '[INFO]';
      await resend.emails.send({
        from: EMAIL_FROM,
        to: [ALERT_EMAIL],
        subject: `${severityEmoji} SignalDB Alert: ${opts.type}${opts.serviceName ? ` - ${opts.serviceName}` : ''}`,
        html: `
          <h2>${severityEmoji} ${opts.type}</h2>
          ${opts.serviceName ? `<p><strong>Service:</strong> ${opts.serviceName}</p>` : ''}
          <p><strong>Severity:</strong> ${opts.severity}</p>
          <p><strong>Message:</strong> ${opts.message}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">SignalDB Infrastructure Monitoring</p>
        `,
      });
    } catch (err) {
      logger.error('[alerting] Failed to send alert email', err instanceof Error ? err : new Error(String(err)));
    }
  } else {
    logger.warn(`[alerting] RESEND_API_KEY not configured. Alert: ${opts.type} - ${opts.message}`);
  }

  return true;
}

/**
 * Resolve an alert: mark as resolved in DB + send resolution email
 */
export async function resolveAlert(type: string, serviceName?: string): Promise<void> {
  // Mark resolved in DB
  try {
    if (serviceName) {
      await sql`
        UPDATE alert_history
        SET resolved_at = now()
        WHERE alert_type = ${type}
          AND service_name = ${serviceName}
          AND resolved_at IS NULL
      `;
    } else {
      await sql`
        UPDATE alert_history
        SET resolved_at = now()
        WHERE alert_type = ${type}
          AND resolved_at IS NULL
      `;
    }
  } catch (err) {
    logger.error('[alerting] Failed to resolve alert in DB', err instanceof Error ? err : new Error(String(err)));
  }

  // Clear cooldown so we can alert again if it goes down
  const cooldownKey = `${type}:${serviceName || 'global'}`;
  lastAlertTimes.delete(cooldownKey);

  // Send resolution email
  if (resend) {
    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: [ALERT_EMAIL],
        subject: `[RESOLVED] SignalDB Alert: ${type}${serviceName ? ` - ${serviceName}` : ''}`,
        html: `
          <h2>[RESOLVED] ${type}</h2>
          ${serviceName ? `<p><strong>Service:</strong> ${serviceName}</p>` : ''}
          <p><strong>Status:</strong> Resolved</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">SignalDB Infrastructure Monitoring</p>
        `,
      });
    } catch (err) {
      logger.error('[alerting] Failed to send resolution email', err instanceof Error ? err : new Error(String(err)));
    }
  }
}

/**
 * Get alert history (most recent first)
 */
export async function getAlertHistory(limit: number = 100): Promise<Array<{
  id: string;
  alert_type: string;
  severity: string;
  service_name: string | null;
  message: string;
  created_at: Date;
  resolved_at: Date | null;
}>> {
  try {
    const rows = await sql`
      SELECT id, alert_type, severity, service_name, message, created_at, resolved_at
      FROM alert_history
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows as any[];
  } catch {
    return [];
  }
}

/**
 * Get unresolved alerts
 */
export async function getUnresolvedAlerts(): Promise<Array<{
  id: string;
  alert_type: string;
  severity: string;
  service_name: string | null;
  message: string;
  created_at: Date;
}>> {
  try {
    const rows = await sql`
      SELECT id, alert_type, severity, service_name, message, created_at
      FROM alert_history
      WHERE resolved_at IS NULL
      ORDER BY created_at DESC
    `;
    return rows as any[];
  } catch {
    return [];
  }
}
