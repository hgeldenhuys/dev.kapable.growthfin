/**
 * Workspace Audit Logging Service
 * Tracks all workspace changes for compliance and debugging
 */

import type { Database } from '@agios/db';
import { workspaceAuditLog, type NewWorkspaceAuditLog } from '@agios/db';

export interface AuditEventParams {
  workspaceId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  changes?: {
    before?: any;
    after?: any;
  };
}

/**
 * Log an audit event to the workspace_audit_log table
 * This is a fire-and-forget operation - errors are logged but don't block the main operation
 *
 * @param db - Database instance
 * @param params - Audit event parameters
 */
export async function logAuditEvent(db: Database, params: AuditEventParams): Promise<void> {
  try {
    const auditEntry: NewWorkspaceAuditLog = {
      workspaceId: params.workspaceId,
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      changes: params.changes || null,
    };

    await db.insert(workspaceAuditLog).values(auditEntry);

    console.log(`[Audit] ${params.action} - ${params.resourceType}`, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      resourceId: params.resourceId,
    });
  } catch (error) {
    // Log error but don't throw - audit logging should never block operations
    console.error('[Audit] Failed to log audit event:', error, params);
  }
}

/**
 * Common audit action types
 */
export const AuditActions = {
  // Member actions
  INVITED_MEMBER: 'invited_member',
  ACCEPTED_INVITATION: 'accepted_invitation',
  CHANGED_ROLE: 'changed_role',
  REMOVED_MEMBER: 'removed_member',

  // Workspace actions
  WORKSPACE_CLONED: 'workspace_cloned',
  WORKSPACE_DELETED: 'workspace_deleted',

  // Resource actions (future use)
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  RESTORED: 'restored',

  // Campaign actions (future use)
  ACTIVATED_CAMPAIGN: 'activated_campaign',
  PAUSED_CAMPAIGN: 'paused_campaign',
  ARCHIVED_CAMPAIGN: 'archived_campaign',
  SENT_CAMPAIGN: 'sent_campaign',
} as const;

/**
 * Common resource types
 */
export const ResourceTypes = {
  WORKSPACE_MEMBER: 'workspace_member',
  WORKSPACE_SETTINGS: 'workspace_settings',
  CAMPAIGN: 'campaign',
  CONTACT: 'contact',
  ACCOUNT: 'account',
  LEAD: 'lead',
  OPPORTUNITY: 'opportunity',
} as const;
