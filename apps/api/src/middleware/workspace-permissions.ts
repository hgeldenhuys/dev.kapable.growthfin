/**
 * Workspace Permission Middleware
 * Role-based access control for multi-tenant workspaces
 *
 * Permission Matrix:
 * - Viewer: Can read all data
 * - Member: Can read + create/edit/delete own resources
 * - Admin: Can read + create/edit/delete any resources
 * - Owner: Full access (same as admin + workspace management)
 */

import { Elysia, t } from 'elysia';
import { db as dbClient } from '@agios/db';
import { eq, and } from 'drizzle-orm';
import { workspaceMembers, workspaces } from '@agios/db/schema';
import type { WorkspaceRole } from '@agios/db/schema';

// Custom errors
class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

/**
 * Extracts workspace ID from request context
 * Checks params first, then query, then body
 */
function extractWorkspaceId(context: any, paramName: string): string | null {
  return (
    context.params?.[paramName] ||
    context.query?.workspaceId ||
    context.body?.workspaceId ||
    null
  );
}

/**
 * Middleware to verify workspace membership and extract workspace context
 *
 * Usage:
 * .use(requireWorkspaceMember())
 * .use(requireWorkspaceMember('customParamName'))
 *
 * Adds to context:
 * - workspace: Full workspace object
 * - userRole: User's role in workspace
 * - workspaceMembership: Full membership record
 * - userId: User ID (from request body/query)
 *
 * Note: Currently extracts userId from body/query parameters.
 * TODO: Integrate with Better Auth for session-based authentication
 */
export const requireWorkspaceMember = (workspaceIdParam = 'workspaceId') =>
  new Elysia({ name: 'workspace-member' })
    .derive(async ({ params, query, body, set }) => {
      // Use direct DB import since context.db may not be available in all module configurations
      const db = dbClient;

      // Extract workspace ID from request
      const workspaceId = extractWorkspaceId({ params, query, body }, workspaceIdParam);

      if (!workspaceId) {
        set.status = 400;
        throw new Error('Workspace ID required');
      }

      // Extract user ID from various sources
      // Prioritizes body fields, then query params
      const userId =
        body?.userId ||
        body?.createdBy ||
        body?.createdById ||
        body?.updatedBy ||
        body?.updatedById ||
        body?.ownerId ||
        body?.assigneeId ||
        body?.addedBy ||
        query?.userId;

      // For now, if no userId is provided, we skip membership check
      // This allows read-only endpoints to work without auth
      // The role check will enforce permissions for write operations
      if (!userId) {
        // Just verify workspace exists
        const workspace = await db.query.workspaces.findFirst({
          where: eq(workspaces.id, workspaceId),
        });

        if (!workspace) {
          set.status = 404;
          throw new NotFoundError('Workspace not found');
        }

        // Return context without user/role (will fail role checks)
        return {
          userId: null,
          workspace,
          userRole: 'viewer' as const, // Default to viewer for anonymous requests
          workspaceMembership: null,
        };
      }

      // Check workspace membership
      const membership = await db.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.status, 'active')
        ),
        with: {
          workspace: true,
        },
      });

      // If no membership found, check if workspace exists for proper error code
      if (!membership) {
        const workspace = await db.query.workspaces.findFirst({
          where: eq(workspaces.id, workspaceId),
        });

        if (!workspace) {
          set.status = 404;
          throw new NotFoundError('Workspace not found');
        }

        set.status = 403;
        throw new ForbiddenError('Not a member of this workspace');
      }

      // Add context for downstream handlers
      return {
        userId,
        workspace: membership.workspace,
        userRole: membership.role,
        workspaceMembership: membership,
      };
    })
    .onError(({ code, error, set }) => {
      // Handle custom errors
      if (error instanceof UnauthorizedError) {
        set.status = 401;
        return { error: error.message };
      }
      if (error instanceof ForbiddenError) {
        set.status = 403;
        return { error: error.message };
      }
      if (error instanceof NotFoundError) {
        set.status = 404;
        return { error: error.message };
      }

      // Let other errors bubble up
      throw error;
    });

/**
 * Middleware to require minimum role level
 *
 * Usage:
 * .use(requireWorkspaceRole('viewer'))   // Read access
 * .use(requireWorkspaceRole('member'))   // Create/edit own
 * .use(requireWorkspaceRole('admin'))    // Delete/edit any
 *
 * Must be used AFTER requireWorkspaceMember()
 */
export const requireWorkspaceRole = (minRole: WorkspaceRole) =>
  new Elysia({ name: 'workspace-role' })
    .derive(({ userRole, set }) => {
      if (!userRole) {
        set.status = 500;
        throw new Error('requireWorkspaceMember must be called before requireWorkspaceRole');
      }

      const userRoleLevel = ROLE_HIERARCHY[userRole];
      const requiredRoleLevel = ROLE_HIERARCHY[minRole];

      if (userRoleLevel < requiredRoleLevel) {
        set.status = 403;
        throw new ForbiddenError(`Requires ${minRole} role or higher (you have ${userRole})`);
      }

      return {};
    })
    .onError(({ error, set }) => {
      if (error instanceof ForbiddenError) {
        set.status = 403;
        return { error: error.message };
      }
      throw error;
    });

/**
 * Middleware to check resource ownership for member role
 * Members can only edit/delete their own resources
 *
 * Usage:
 * .use(requireOwnershipOrAdmin(resource, 'created_by'))
 *
 * Must be used AFTER requireWorkspaceMember()
 */
export const requireOwnershipOrAdmin = (resource: any, ownerField = 'createdBy') =>
  new Elysia({ name: 'require-ownership' })
    .derive(({ userId, userRole, set }) => {
      if (!userRole) {
        set.status = 500;
        throw new Error('requireWorkspaceMember must be called first');
      }

      // Admin and owner can modify anything
      if (userRole === 'admin' || userRole === 'owner') {
        return {};
      }

      // Member can only modify their own resources
      if (userRole === 'member') {
        const ownerId = resource[ownerField];
        if (ownerId !== userId) {
          set.status = 403;
          throw new ForbiddenError('Can only modify your own resources');
        }
      }

      return {};
    })
    .onError(({ error, set }) => {
      if (error instanceof ForbiddenError) {
        set.status = 403;
        return { error: error.message };
      }
      throw error;
    });

// Export errors for use in other files
export { UnauthorizedError, ForbiddenError, NotFoundError };
