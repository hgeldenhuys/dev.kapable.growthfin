/**
 * BFF Database Connection Layer
 *
 * Server-only module for direct database access in loaders/actions.
 * Uses the shared Drizzle ORM client from @agios/db package.
 *
 * The .server.ts suffix ensures this module is never bundled to the client.
 *
 * @example
 * ```typescript
 * // In a loader
 * import { db, crmLeads } from '~/lib/db.server';
 * import { eq } from 'drizzle-orm';
 *
 * export async function loader({ params }) {
 *   const leads = await db.select().from(crmLeads).where(eq(crmLeads.workspaceId, params.workspaceId));
 *   return { leads };
 * }
 * ```
 */

// Re-export the shared database client
export { db, type Database } from '@agios/db';

// Re-export commonly used schema tables for convenience
export {
  crmLeads,
  crmContacts,
  crmAccounts,
  crmOpportunities,
  crmActivities,
  crmCampaigns,
  crmBatches,
  // Alias crmBatches as crmTasks for backward compatibility with routes that use "tasks" terminology
  crmBatches as crmTasks,
  workItems,
  workspaces,
  workspaceMembers,
  users,
  sessions,
  type CrmLead,
  type CrmContact,
  type CrmAccount,
  type CrmOpportunity,
  type CrmActivity,
  type CrmCampaign,
  type CrmBatch,
  type CrmBatch as CrmTask,
  type WorkItem,
  type Workspace,
  type User,
  crmTickets,
  type CrmTicket,
  crmEmailTemplates,
  type CrmEmailTemplate,
} from '@agios/db';

// Re-export Drizzle ORM helpers for queries
export { eq, and, or, desc, asc, sql, inArray, isNull, isNotNull, like, ilike } from 'drizzle-orm';
