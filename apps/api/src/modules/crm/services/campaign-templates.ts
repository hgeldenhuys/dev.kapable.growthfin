/**
 * Campaign Templates Service
 * US-CAMPAIGN-TEMPLATE-006: Template Library
 *
 * Handles CRUD operations for campaign templates with versioning support
 */

import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import {
  campaignTemplates,
  type NewCampaignTemplate,
  type CampaignTemplate,
  type TemplateCategory,
  type TemplateStatus,
} from '@agios/db/schema';

export class CampaignTemplateService {
  /**
   * Create a new template
   */
  static async create(
    db: NodePgDatabase<any>,
    data: NewCampaignTemplate
  ): Promise<CampaignTemplate> {
    const templates = await db
      .insert(campaignTemplates)
      .values({
        version: 1,
        isLatestVersion: true,
        ...data, // Allow data to override defaults
      })
      .returning();

    return templates[0];
  }

  /**
   * Get template by ID
   */
  static async getById(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string
  ): Promise<CampaignTemplate | null> {
    const templates = await db
      .select()
      .from(campaignTemplates)
      .where(
        and(
          eq(campaignTemplates.id, id),
          eq(campaignTemplates.workspaceId, workspaceId),
          isNull(campaignTemplates.deletedAt)
        )
      )
      .limit(1);

    return templates[0] || null;
  }

  /**
   * List templates with filtering
   */
  static async list(
    db: NodePgDatabase<any>,
    workspaceId: string,
    options?: {
      category?: TemplateCategory;
      status?: TemplateStatus;
      tags?: string[];
      latestOnly?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ templates: CampaignTemplate[]; total: number }> {
    const {
      category,
      status,
      tags,
      latestOnly = true,
      limit = 50,
      offset = 0,
    } = options || {};

    const conditions = [
      eq(campaignTemplates.workspaceId, workspaceId),
      isNull(campaignTemplates.deletedAt),
    ];

    if (category) {
      conditions.push(eq(campaignTemplates.category, category));
    }

    if (status) {
      conditions.push(eq(campaignTemplates.status, status));
    }

    if (latestOnly) {
      conditions.push(eq(campaignTemplates.isLatestVersion, true));
    }

    // Get templates
    let query = db
      .select()
      .from(campaignTemplates)
      .where(and(...conditions))
      .orderBy(desc(campaignTemplates.createdAt))
      .limit(limit)
      .offset(offset);

    const templates = await query;

    // Filter by tags if provided (client-side filtering for JSONB arrays)
    let filteredTemplates = templates;
    if (tags && tags.length > 0) {
      filteredTemplates = templates.filter((template) => {
        const templateTags = (template.tags as string[]) || [];
        return tags.some((tag) => templateTags.includes(tag));
      });
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaignTemplates)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    return { templates: filteredTemplates, total };
  }

  /**
   * Update template
   */
  static async update(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string,
    data: Partial<NewCampaignTemplate>
  ): Promise<CampaignTemplate | null> {
    const templates = await db
      .update(campaignTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignTemplates.id, id),
          eq(campaignTemplates.workspaceId, workspaceId),
          isNull(campaignTemplates.deletedAt)
        )
      )
      .returning();

    return templates[0] || null;
  }

  /**
   * Create a new version of a template
   */
  static async createVersion(
    db: NodePgDatabase<any>,
    parentId: string,
    workspaceId: string,
    data: Partial<NewCampaignTemplate>
  ): Promise<CampaignTemplate> {
    // Get parent template
    const parent = await this.getById(db, parentId, workspaceId);
    if (!parent) {
      throw new Error('Parent template not found');
    }

    // Mark all existing versions as not latest
    await db
      .update(campaignTemplates)
      .set({ isLatestVersion: false })
      .where(
        and(
          eq(campaignTemplates.parentTemplateId, parentId),
          eq(campaignTemplates.workspaceId, workspaceId),
          isNull(campaignTemplates.deletedAt)
        )
      );

    // Mark parent as not latest
    await db
      .update(campaignTemplates)
      .set({ isLatestVersion: false })
      .where(eq(campaignTemplates.id, parentId));

    // Create new version
    const newVersion = await this.create(db, {
      ...data,
      workspaceId,
      parentTemplateId: parentId,
      version: parent.version + 1,
      isLatestVersion: true,
      name: data.name || parent.name,
      templateData: data.templateData || parent.templateData,
      category: data.category || parent.category,
    });

    return newVersion;
  }

  /**
   * Get template versions
   */
  static async getVersions(
    db: NodePgDatabase<any>,
    parentId: string,
    workspaceId: string
  ): Promise<CampaignTemplate[]> {
    const versions = await db
      .select()
      .from(campaignTemplates)
      .where(
        and(
          eq(campaignTemplates.parentTemplateId, parentId),
          eq(campaignTemplates.workspaceId, workspaceId),
          isNull(campaignTemplates.deletedAt)
        )
      )
      .orderBy(desc(campaignTemplates.version));

    return versions;
  }

  /**
   * Soft delete template
   */
  static async delete(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string
  ): Promise<boolean> {
    const templates = await db
      .update(campaignTemplates)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignTemplates.id, id),
          eq(campaignTemplates.workspaceId, workspaceId),
          isNull(campaignTemplates.deletedAt)
        )
      )
      .returning();

    return templates.length > 0;
  }

  /**
   * Increment usage count when template is used
   */
  static async incrementUsageCount(
    db: NodePgDatabase<any>,
    id: string,
    workspaceId: string
  ): Promise<void> {
    await db
      .update(campaignTemplates)
      .set({
        usageCount: sql`${campaignTemplates.usageCount} + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(campaignTemplates.id, id),
          eq(campaignTemplates.workspaceId, workspaceId),
          isNull(campaignTemplates.deletedAt)
        )
      );
  }

  /**
   * Get popular templates (by usage count)
   */
  static async getPopular(
    db: NodePgDatabase<any>,
    workspaceId: string,
    limit: number = 10
  ): Promise<CampaignTemplate[]> {
    const templates = await db
      .select()
      .from(campaignTemplates)
      .where(
        and(
          eq(campaignTemplates.workspaceId, workspaceId),
          eq(campaignTemplates.status, 'active'),
          isNull(campaignTemplates.deletedAt)
        )
      )
      .orderBy(desc(campaignTemplates.usageCount))
      .limit(limit);

    return templates;
  }

  /**
   * Get recent templates (by last used)
   */
  static async getRecent(
    db: NodePgDatabase<any>,
    workspaceId: string,
    seconds: number = 86400 // 24 hours
  ): Promise<CampaignTemplate[]> {
    const cutoffDate = new Date(Date.now() - seconds * 1000);

    const templates = await db
      .select()
      .from(campaignTemplates)
      .where(
        and(
          eq(campaignTemplates.workspaceId, workspaceId),
          isNull(campaignTemplates.deletedAt),
          sql`${campaignTemplates.createdAt} > ${cutoffDate}`
        )
      )
      .orderBy(desc(campaignTemplates.createdAt));

    return templates;
  }
}

export const campaignTemplateService = CampaignTemplateService;
