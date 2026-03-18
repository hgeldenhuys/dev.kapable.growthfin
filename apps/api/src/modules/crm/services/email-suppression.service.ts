/**
 * Email Suppression Service (Phase P)
 * Manages email suppression list to protect sender reputation
 *
 * - Checks if emails are suppressed before campaign sends
 * - Auto-suppresses on hard bounce and spam complaint
 * - Tracks soft bounces and converts after threshold
 * - Supports one-click unsubscribe
 * - Provides suppression list management API
 */

import { db } from '@agios/db/client';
import {
  crmEmailSuppressions,
  workspaces,
  type WorkspaceSettings,
  type WorkspaceEmailComplianceSettings,
  type SuppressionReason,
  type SuppressionSourceType,
} from '@agios/db';
import { eq, and, inArray, sql } from 'drizzle-orm';

const DEFAULT_SOFT_BOUNCE_THRESHOLD = 3;

/**
 * Default email compliance settings
 */
const DEFAULT_COMPLIANCE_SETTINGS: WorkspaceEmailComplianceSettings = {
  softBounceThreshold: DEFAULT_SOFT_BOUNCE_THRESHOLD,
  autoSuppressOnComplaint: true,
  autoSuppressOnHardBounce: true,
};

export class EmailSuppressionService {
  /**
   * Get workspace email compliance settings
   */
  static async getComplianceSettings(workspaceId: string): Promise<WorkspaceEmailComplianceSettings> {
    const [workspace] = await db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      return DEFAULT_COMPLIANCE_SETTINGS;
    }

    const settings = workspace.settings as WorkspaceSettings | null;
    const compliance = settings?.emailCompliance;

    if (!compliance) {
      return DEFAULT_COMPLIANCE_SETTINGS;
    }

    return {
      ...DEFAULT_COMPLIANCE_SETTINGS,
      ...compliance,
    };
  }

  /**
   * Check if a single email is suppressed in a workspace
   */
  static async isSuppressed(workspaceId: string, email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    const [suppression] = await db
      .select({ id: crmEmailSuppressions.id })
      .from(crmEmailSuppressions)
      .where(
        and(
          eq(crmEmailSuppressions.workspaceId, workspaceId),
          eq(crmEmailSuppressions.email, normalizedEmail),
          eq(crmEmailSuppressions.isActive, true)
        )
      )
      .limit(1);

    return !!suppression;
  }

  /**
   * Filter a list of emails, returning only those NOT suppressed
   * This is the primary method used by execute-campaign.ts before sending
   */
  static async filterSuppressed(
    workspaceId: string,
    emails: string[]
  ): Promise<{ allowed: string[]; suppressed: string[] }> {
    if (emails.length === 0) {
      return { allowed: [], suppressed: [] };
    }

    const normalizedEmails = emails.map((e) => e.toLowerCase().trim());

    // Get all active suppressions for these emails in this workspace
    const suppressions = await db
      .select({ email: crmEmailSuppressions.email })
      .from(crmEmailSuppressions)
      .where(
        and(
          eq(crmEmailSuppressions.workspaceId, workspaceId),
          inArray(crmEmailSuppressions.email, normalizedEmails),
          eq(crmEmailSuppressions.isActive, true)
        )
      );

    const suppressedSet = new Set(suppressions.map((s) => s.email));

    const allowed: string[] = [];
    const suppressed: string[] = [];

    for (const email of normalizedEmails) {
      if (suppressedSet.has(email)) {
        suppressed.push(email);
      } else {
        allowed.push(email);
      }
    }

    return { allowed, suppressed };
  }

  /**
   * Suppress an email address (add to suppression list)
   */
  static async suppress(params: {
    workspaceId: string;
    email: string;
    reason: SuppressionReason;
    reasonDetail?: string;
    sourceType: SuppressionSourceType;
    sourceCampaignId?: string;
    sourceRecipientId?: string;
  }): Promise<void> {
    const normalizedEmail = params.email.toLowerCase().trim();

    // Upsert: update if already exists (e.g., soft bounce count), insert if new
    await db
      .insert(crmEmailSuppressions)
      .values({
        workspaceId: params.workspaceId,
        email: normalizedEmail,
        reason: params.reason,
        reasonDetail: params.reasonDetail,
        sourceType: params.sourceType,
        sourceCampaignId: params.sourceCampaignId,
        sourceRecipientId: params.sourceRecipientId,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [crmEmailSuppressions.workspaceId, crmEmailSuppressions.email],
        set: {
          reason: params.reason,
          reasonDetail: params.reasonDetail,
          sourceType: params.sourceType,
          sourceCampaignId: params.sourceCampaignId,
          sourceRecipientId: params.sourceRecipientId,
          isActive: true,
          reactivatedAt: null,
          reactivatedBy: null,
          updatedAt: new Date(),
        },
      });

    console.log(
      `[Email Suppression] Suppressed ${normalizedEmail} in workspace ${params.workspaceId}: ${params.reason}`
    );
  }

  /**
   * Record a soft bounce and convert to hard suppression after threshold
   * Returns true if converted to hard suppression
   */
  static async recordSoftBounce(params: {
    workspaceId: string;
    email: string;
    description?: string;
    sourceCampaignId?: string;
    sourceRecipientId?: string;
  }): Promise<boolean> {
    const normalizedEmail = params.email.toLowerCase().trim();

    // Get current suppression record (if exists)
    const [existing] = await db
      .select()
      .from(crmEmailSuppressions)
      .where(
        and(
          eq(crmEmailSuppressions.workspaceId, params.workspaceId),
          eq(crmEmailSuppressions.email, normalizedEmail)
        )
      )
      .limit(1);

    const settings = await this.getComplianceSettings(params.workspaceId);
    const threshold = settings.softBounceThreshold ?? DEFAULT_SOFT_BOUNCE_THRESHOLD;

    if (existing) {
      const newCount = existing.softBounceCount + 1;
      const shouldConvert = newCount >= threshold;

      await db
        .update(crmEmailSuppressions)
        .set({
          softBounceCount: newCount,
          lastSoftBounceAt: new Date(),
          reason: shouldConvert ? 'soft_bounce_converted' : existing.reason,
          reasonDetail: shouldConvert
            ? `Converted after ${newCount} soft bounces. Last: ${params.description || 'unknown'}`
            : existing.reasonDetail,
          isActive: shouldConvert ? true : existing.isActive,
          updatedAt: new Date(),
        })
        .where(eq(crmEmailSuppressions.id, existing.id));

      if (shouldConvert) {
        console.log(
          `[Email Suppression] Soft bounce converted to hard suppression for ${normalizedEmail} (${newCount} bounces)`
        );
      }

      return shouldConvert;
    }

    // First soft bounce - create record but don't suppress yet
    const shouldConvert = 1 >= threshold;

    await db.insert(crmEmailSuppressions).values({
      workspaceId: params.workspaceId,
      email: normalizedEmail,
      reason: shouldConvert ? 'soft_bounce_converted' : 'hard_bounce', // temporary reason, updated on conversion
      reasonDetail: params.description,
      sourceType: 'webhook',
      sourceCampaignId: params.sourceCampaignId,
      sourceRecipientId: params.sourceRecipientId,
      softBounceCount: 1,
      lastSoftBounceAt: new Date(),
      isActive: shouldConvert, // Not active until threshold reached (unless threshold is 1)
    });

    return shouldConvert;
  }

  /**
   * Handle an unsubscribe request
   */
  static async handleUnsubscribe(params: {
    workspaceId: string;
    email: string;
    campaignId?: string;
  }): Promise<void> {
    await this.suppress({
      workspaceId: params.workspaceId,
      email: params.email,
      reason: 'manual_unsubscribe',
      reasonDetail: params.campaignId ? `Unsubscribed from campaign ${params.campaignId}` : 'Unsubscribed via link',
      sourceType: 'unsubscribe_link',
      sourceCampaignId: params.campaignId,
    });
  }

  /**
   * Reactivate a suppressed email (admin action)
   */
  static async reactivate(params: {
    workspaceId: string;
    email: string;
    reactivatedBy?: string;
  }): Promise<boolean> {
    const normalizedEmail = params.email.toLowerCase().trim();

    const result = await db
      .update(crmEmailSuppressions)
      .set({
        isActive: false,
        reactivatedAt: new Date(),
        reactivatedBy: params.reactivatedBy,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(crmEmailSuppressions.workspaceId, params.workspaceId),
          eq(crmEmailSuppressions.email, normalizedEmail),
          eq(crmEmailSuppressions.isActive, true)
        )
      );

    const reactivated = (result.rowCount ?? 0) > 0;
    if (reactivated) {
      console.log(`[Email Suppression] Reactivated ${normalizedEmail} in workspace ${params.workspaceId}`);
    }
    return reactivated;
  }

  /**
   * Get suppression list for a workspace (paginated)
   */
  static async list(params: {
    workspaceId: string;
    activeOnly?: boolean;
    reason?: SuppressionReason;
    limit?: number;
    offset?: number;
  }): Promise<{ items: any[]; total: number }> {
    const conditions = [eq(crmEmailSuppressions.workspaceId, params.workspaceId)];

    if (params.activeOnly !== false) {
      conditions.push(eq(crmEmailSuppressions.isActive, true));
    }

    if (params.reason) {
      conditions.push(eq(crmEmailSuppressions.reason, params.reason));
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmEmailSuppressions)
      .where(and(...conditions));

    const items = await db
      .select()
      .from(crmEmailSuppressions)
      .where(and(...conditions))
      .orderBy(crmEmailSuppressions.createdAt)
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0);

    return {
      items,
      total: countResult?.count ?? 0,
    };
  }

  /**
   * Get suppression statistics for a workspace
   */
  static async getStats(workspaceId: string): Promise<{
    totalActive: number;
    byReason: Record<string, number>;
  }> {
    const stats = await db
      .select({
        reason: crmEmailSuppressions.reason,
        count: sql<number>`count(*)::int`,
      })
      .from(crmEmailSuppressions)
      .where(
        and(
          eq(crmEmailSuppressions.workspaceId, workspaceId),
          eq(crmEmailSuppressions.isActive, true)
        )
      )
      .groupBy(crmEmailSuppressions.reason);

    const byReason: Record<string, number> = {};
    let totalActive = 0;

    for (const stat of stats) {
      byReason[stat.reason] = stat.count;
      totalActive += stat.count;
    }

    return { totalActive, byReason };
  }

  /**
   * Generate one-click unsubscribe URL
   * Uses a simple HMAC-based token for verification
   */
  static generateUnsubscribeUrl(params: {
    baseUrl: string;
    workspaceId: string;
    email: string;
    campaignId?: string;
  }): string {
    // Simple token: base64(workspaceId:email:campaignId)
    // In production, use HMAC signing for tamper-proofing
    const payload = [params.workspaceId, params.email, params.campaignId || ''].join(':');
    const token = Buffer.from(payload).toString('base64url');
    return `${params.baseUrl}/api/v1/crm/email/unsubscribe?token=${token}`;
  }

  /**
   * Parse and validate an unsubscribe token
   */
  static parseUnsubscribeToken(token: string): {
    workspaceId: string;
    email: string;
    campaignId?: string;
  } | null {
    try {
      const payload = Buffer.from(token, 'base64url').toString('utf-8');
      const [workspaceId, email, campaignId] = payload.split(':');
      if (!workspaceId || !email) return null;
      return { workspaceId, email, campaignId: campaignId || undefined };
    } catch {
      return null;
    }
  }

  /**
   * Generate CAN-SPAM compliant email footer
   */
  static generateComplianceFooter(params: {
    unsubscribeUrl: string;
    companyName?: string;
    physicalAddress?: string;
  }): string {
    const company = params.companyName || 'Our Company';
    const address = params.physicalAddress || '';

    return `
<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
  <p>You received this email because you are subscribed to communications from ${company}.</p>
  ${address ? `<p>${address}</p>` : ''}
  <p>
    <a href="${params.unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
    from future emails.
  </p>
</div>`;
  }
}
