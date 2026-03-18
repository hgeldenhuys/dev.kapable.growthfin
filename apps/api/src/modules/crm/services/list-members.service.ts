/**
 * List Members Service
 * Business logic for list membership operations with polymorphic entity joins
 */

import type { Database } from '@agios/db';
import { and, eq, sql, isNull, inArray, SQL } from 'drizzle-orm';
import * as schema from '@agios/db/schema';
import type { CrmEntityType, NewCrmContactListMembership } from '@agios/db/schema/contact-lists';
import { listFiltersService, type CustomFieldFilter } from './list-filters.service';

/**
 * Member with joined entity data
 */
export interface ListMemberWithEntity {
  id: string;
  listId: string;
  entityType: CrmEntityType;
  entityId: string;
  addedAt: Date;
  addedBy: string | null;
  source: string;
  isActive: boolean;
  entity: any; // Polymorphic - structure depends on entity type
}

/**
 * Get list members with entity data joined polymorphically
 */
export async function getListMembers(
  db: Database,
  listId: string,
  workspaceId: string,
  customFieldFilters: CustomFieldFilter[] = []
): Promise<{ members: ListMemberWithEntity[]; customFieldSchema: any }> {
  // Verify list ownership
  const list = await db
    .select()
    .from(schema.crmContactLists)
    .where(
      and(
        eq(schema.crmContactLists.id, listId),
        eq(schema.crmContactLists.workspaceId, workspaceId),
        isNull(schema.crmContactLists.deletedAt)
      )
    )
    .limit(1);

  if (!list[0]) {
    throw new Error('List not found');
  }

  const entityType = list[0].entityType;
  const customFieldSchema = list[0].customFieldSchema || {};

  // Build polymorphic query with CASE-based joins
  // This approach allows us to join different entity tables based on entity_type
  const result = await db.execute(sql`
    SELECT
      m.id,
      m.list_id,
      m.entity_type,
      m.entity_id,
      m.added_at,
      m.added_by,
      m.source,
      m.is_active,
      m.enrichment_score,
      m.enrichment_data,
      m.enriched_at,
      CASE
        WHEN m.entity_type = 'contact' THEN jsonb_build_object(
          'id', c.id,
          'firstName', c.first_name,
          'lastName', c.last_name,
          'email', c.email,
          'emailSecondary', c.email_secondary,
          'phone', c.phone,
          'phoneSecondary', c.phone_secondary,
          'mobile', c.mobile,
          'title', c.title,
          'department', c.department,
          'accountId', c.account_id,
          'convertedFromLeadId', c.converted_from_lead_id,
          'status', c.status,
          'lifecycleStage', c.lifecycle_stage,
          'leadScore', c.lead_score,
          'engagementScore', c.engagement_score,
          'leadSource', c.lead_source,
          'ownerId', c.owner_id,
          'consentMarketing', c.consent_marketing,
          'consentMarketingDate', c.consent_marketing_date,
          'consentMarketingVersion', c.consent_marketing_version,
          'consentTransactional', c.consent_transactional,
          'consentTransactionalDate', c.consent_transactional_date,
          'tags', c.tags,
          'customFields', c.custom_fields,
          'createdAt', c.created_at,
          'updatedAt', c.updated_at,
          'createdBy', c.created_by,
          'updatedBy', c.updated_by
        )
        WHEN m.entity_type = 'lead' THEN jsonb_build_object(
          'id', l.id,
          'firstName', l.first_name,
          'lastName', l.last_name,
          'companyName', l.company_name,
          'email', l.email,
          'phone', l.phone,
          'status', l.status,
          'source', l.source,
          'leadScore', l.lead_score,
          'estimatedValue', l.estimated_value,
          'expectedCloseDate', l.expected_close_date,
          'callbackDate', l.callback_date,
          'lastContactDate', l.last_contact_date,
          'propensityScore', l.propensity_score,
          'propensityScoreUpdatedAt', l.propensity_score_updated_at,
          'scoreBreakdown', l.score_breakdown,
          'campaignId', l.campaign_id,
          'ownerId', l.owner_id,
          'convertedContactId', l.converted_contact_id,
          'convertedAt', l.converted_at,
          'tags', l.tags,
          'customFields', l.custom_fields,
          'createdAt', l.created_at,
          'updatedAt', l.updated_at,
          'createdBy', l.created_by,
          'updatedBy', l.updated_by
        )
        WHEN m.entity_type = 'account' THEN jsonb_build_object(
          'id', a.id,
          'name', a.name,
          'industry', a.industry,
          'employeeCount', a.employee_count,
          'annualRevenue', a.annual_revenue,
          'website', a.website,
          'parentAccountId', a.parent_account_id,
          'ownerId', a.owner_id,
          'healthScore', a.health_score,
          'healthScoreUpdatedAt', a.health_score_updated_at,
          'tags', a.tags,
          'customFields', a.custom_fields,
          'createdAt', a.created_at,
          'updatedAt', a.updated_at,
          'createdBy', a.created_by,
          'updatedBy', a.updated_by
        )
        WHEN m.entity_type = 'opportunity' THEN jsonb_build_object(
          'id', o.id,
          'accountId', o.account_id,
          'contactId', o.contact_id,
          'name', o.name,
          'stage', o.stage,
          'status', o.status,
          'amount', o.amount,
          'currency', o.currency,
          'probability', o.probability,
          'expectedCloseDate', o.expected_close_date,
          'actualCloseDate', o.actual_close_date,
          'winLossReason', o.win_loss_reason,
          'ownerId', o.owner_id,
          'leadSource', o.lead_source,
          'tags', o.tags,
          'customFields', o.custom_fields,
          'createdAt', o.created_at,
          'updatedAt', o.updated_at,
          'createdBy', o.created_by,
          'updatedBy', o.updated_by
        )
      END as entity
    FROM ${schema.crmContactListMemberships} m
    LEFT JOIN ${schema.crmContacts} c
      ON m.entity_type = 'contact' AND m.entity_id = c.id AND c.deleted_at IS NULL
    LEFT JOIN ${schema.crmLeads} l
      ON m.entity_type = 'lead' AND m.entity_id = l.id AND l.deleted_at IS NULL
    LEFT JOIN ${schema.crmAccounts} a
      ON m.entity_type = 'account' AND m.entity_id = a.id AND a.deleted_at IS NULL
    LEFT JOIN ${schema.crmOpportunities} o
      ON m.entity_type = 'opportunity' AND m.entity_id = o.id AND o.deleted_at IS NULL
    WHERE
      m.list_id = ${listId}
      AND m.deleted_at IS NULL
      AND m.is_active = true
      AND (
        (m.entity_type = 'contact' AND c.id IS NOT NULL)
        OR (m.entity_type = 'lead' AND l.id IS NOT NULL)
        OR (m.entity_type = 'account' AND a.id IS NOT NULL)
        OR (m.entity_type = 'opportunity' AND o.id IS NOT NULL)
      )
      ${customFieldFilters.length > 0 ? buildCustomFieldFilterSQL(entityType, customFieldFilters) : sql``}
    ORDER BY m.added_at DESC
    LIMIT 10000
  `);

  // Result from db.execute() with raw SQL returns rows in snake_case
  // Map to camelCase to match TypeScript interface
  const rows = Array.isArray(result) ? result : result.rows;

  const members = rows.map((row: any) => ({
    id: row.id,
    listId: row.list_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    addedAt: row.added_at,
    addedBy: row.added_by,
    source: row.source,
    isActive: row.is_active,
    entity: row.entity,
  })) as ListMemberWithEntity[];

  return {
    members,
    customFieldSchema,
  };
}

/**
 * Build custom field filter SQL for the WHERE clause
 */
function buildCustomFieldFilterSQL(entityType: CrmEntityType, filters: CustomFieldFilter[]): SQL {
  if (filters.length === 0) {
    return sql``;
  }

  const entityAlias = getEntityAlias(entityType);
  const conditions: string[] = [];

  for (const filter of filters) {
    // Sanitize field name to prevent SQL injection - only allow alphanumeric and underscore
    const fieldName = filter.field.replace(/[^a-zA-Z0-9_]/g, '');

    switch (filter.operator) {
      case 'exact':
        const exactValue = String(filter.value).replace(/'/g, "''");
        conditions.push(`(${entityAlias}.custom_fields->>'${fieldName}') = '${exactValue}'`);
        break;
      case 'min':
        conditions.push(`(${entityAlias}.custom_fields->>'${fieldName}')::numeric >= ${Number(filter.value)}`);
        break;
      case 'max':
        conditions.push(`(${entityAlias}.custom_fields->>'${fieldName}')::numeric <= ${Number(filter.value)}`);
        break;
      case 'contains':
        const containsValue = String(filter.value).replace(/'/g, "''");
        conditions.push(`LOWER(${entityAlias}.custom_fields->>'${fieldName}') LIKE LOWER('%${containsValue}%')`);
        break;
    }
  }

  if (conditions.length === 0) {
    return sql``;
  }

  // Join all conditions with AND and wrap in parentheses
  const conditionsStr = conditions.join(' AND ');
  return sql.raw(`AND (${conditionsStr})`);
}

/**
 * Get entity table alias for SQL query
 */
function getEntityAlias(entityType: CrmEntityType): string {
  switch (entityType) {
    case 'contact':
      return 'c';
    case 'lead':
      return 'l';
    case 'account':
      return 'a';
    case 'opportunity':
      return 'o';
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Add members to a list (bulk operation)
 */
export async function addMembers(
  db: Database,
  listId: string,
  workspaceId: string,
  entityIds: string[],
  addedBy?: string,
  source: string = 'manual'
): Promise<{ added: number; skipped: number }> {
  // Verify list ownership and get entity type
  const list = await db
    .select()
    .from(schema.crmContactLists)
    .where(
      and(
        eq(schema.crmContactLists.id, listId),
        eq(schema.crmContactLists.workspaceId, workspaceId),
        isNull(schema.crmContactLists.deletedAt)
      )
    )
    .limit(1);

  if (!list[0]) {
    throw new Error('List not found');
  }

  const entityType = list[0].entityType;

  // Validate and normalize entity IDs - filter out invalid UUIDs
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validEntityIds = entityIds.filter((id) => UUID_REGEX.test(id));
  const invalidIds = entityIds.filter((id) => !UUID_REGEX.test(id));

  if (validEntityIds.length === 0) {
    // All IDs are invalid
    return { added: 0, skipped: entityIds.length };
  }

  // Get existing memberships to avoid duplicates
  const existing = await db
    .select({ entityId: schema.crmContactListMemberships.entityId })
    .from(schema.crmContactListMemberships)
    .where(
      and(
        eq(schema.crmContactListMemberships.listId, listId),
        inArray(schema.crmContactListMemberships.entityId, validEntityIds),
        isNull(schema.crmContactListMemberships.deletedAt)
      )
    );

  const existingIds = new Set(existing.map((m) => m.entityId));
  const newEntityIds = validEntityIds.filter((id) => !existingIds.has(id));

  if (newEntityIds.length === 0) {
    return { added: 0, skipped: entityIds.length };
  }

  // Bulk insert new memberships in batches to avoid PostgreSQL parameter limit
  // PostgreSQL has max ~65,000 parameters. With 11 columns per row, we can insert ~5,900 rows per query
  // Using 1000 as a safe batch size for better performance
  const BATCH_SIZE = 1000;
  const memberships: NewCrmContactListMembership[] = newEntityIds.map((entityId) => ({
    workspaceId,
    listId,
    entityType,
    entityId,
    addedBy,
    source: source as any,
    isActive: true,
    enrichmentData: {},
    metadata: {},
    canBeRevived: true,
    revivalCount: 0,
  }));

  // Insert in batches
  for (let i = 0; i < memberships.length; i += BATCH_SIZE) {
    const batch = memberships.slice(i, i + BATCH_SIZE);
    await db.insert(schema.crmContactListMemberships).values(batch);
    console.log(`[list-members] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(memberships.length / BATCH_SIZE)} (${batch.length} members)`);
  }

  // Update list stats
  await db
    .update(schema.crmContactLists)
    .set({
      totalContacts: sql`${schema.crmContactLists.totalContacts} + ${newEntityIds.length}`,
      activeContacts: sql`${schema.crmContactLists.activeContacts} + ${newEntityIds.length}`,
      updatedAt: new Date(),
    })
    .where(eq(schema.crmContactLists.id, listId));

  return {
    added: newEntityIds.length,
    skipped: existingIds.size + invalidIds.length,
  };
}

/**
 * Remove a member from a list (soft delete)
 */
export async function removeMember(
  db: Database,
  listId: string,
  memberId: string,
  workspaceId: string
): Promise<boolean> {
  // Verify ownership via list
  const membership = await db
    .select()
    .from(schema.crmContactListMemberships)
    .innerJoin(
      schema.crmContactLists,
      eq(schema.crmContactListMemberships.listId, schema.crmContactLists.id)
    )
    .where(
      and(
        eq(schema.crmContactListMemberships.id, memberId),
        eq(schema.crmContactListMemberships.listId, listId),
        eq(schema.crmContactLists.workspaceId, workspaceId),
        isNull(schema.crmContactListMemberships.deletedAt)
      )
    )
    .limit(1);

  if (!membership[0]) {
    return false;
  }

  // Soft delete membership
  await db
    .update(schema.crmContactListMemberships)
    .set({
      deletedAt: new Date(),
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(schema.crmContactListMemberships.id, memberId));

  // Update list stats
  await db
    .update(schema.crmContactLists)
    .set({
      totalContacts: sql`${schema.crmContactLists.totalContacts} - 1`,
      activeContacts: sql`${schema.crmContactLists.activeContacts} - 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.crmContactLists.id, listId));

  return true;
}

export const listMembersService = {
  getListMembers,
  addMembers,
  removeMember,
};
