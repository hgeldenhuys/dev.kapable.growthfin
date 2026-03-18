/**
 * Workspace Routes
 * HTTP routes for workspace management
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db/client';
import { eq, and, desc, sql } from 'drizzle-orm';
import { workspaceAuditLog, users } from '@agios/db';
import { workspaceService } from './service';
import { streamWorkspaces } from '../../lib/electric-shapes';

export const workspaceRoutes = new Elysia({ prefix: '/workspaces', tags: ['Workspaces'] })
  /**
   * GET /workspaces - List user's workspaces
   * US-API-001: Returns all workspaces where user is a member with role and member count
   */
  .get(
    '/',
    async ({ query, set }) => {
      // Check if userId is provided
      if (!query.userId) {
        set.status = 400;
        return { error: 'userId query parameter is required' };
      }

      const rawWorkspaces = await workspaceService.listUserWorkspaces(db, query.userId);

      // Transform memberCount to member_count for frontend
      const workspaces = rawWorkspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        role: w.role,
        member_count: w.memberCount,
        settings: w.settings,
        createdAt: w.createdAt,
      }));

      return {
        workspaces,
      };
    },
    {
      query: t.Object({
        userId: t.String(),
      }),
      detail: {
        summary: 'List user workspaces',
        description: 'Get all workspaces where the user is a member, including their role and member count',
      },
    }
  )

  /**
   * GET /workspaces/:id - Get workspace details
   * US-API-002: Returns workspace details with member list (requires membership)
   */
  .get(
    '/:id',
    async ({ params, query, set }) => {
      // Check if userId is provided
      if (!query.userId) {
        set.status = 400;
        return { error: 'userId query parameter is required' };
      }

      const result = await workspaceService.getWorkspaceDetails(db, params.id, query.userId);

      // Handle errors
      if ('error' in result) {
        if (result.error === 'forbidden') {
          set.status = 403;
          return { error: result.message };
        }
        if (result.error === 'not_found') {
          set.status = 404;
          return { error: result.message };
        }
      }

      return result;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        userId: t.String(),
      }),
      detail: {
        summary: 'Get workspace details',
        description: 'Get detailed workspace information including all members. Requires user to be a member of the workspace.',
      },
    }
  )

  /**
   * POST /workspaces - Create a new workspace
   */
  .post(
    '/',
    async ({ body }) => {
      return workspaceService.create(db, body);
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        slug: t.String({ minLength: 1 }),
        ownerId: t.String(),
      }),
    }
  )

  /**
   * PUT /workspaces/:id - Update a workspace
   */
  .put(
    '/:id',
    async ({ params, body }) => {
      return workspaceService.update(db, params.id, body);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Partial(
        t.Object({
          name: t.String({ minLength: 1 }),
          slug: t.String({ minLength: 1 }),
          ownerId: t.String(),
          settings: t.Any(), // Allow any JSONB settings object
        })
      ),
    }
  )

  /**
   * DELETE /workspaces/:id - Delete a workspace
   * Requires requestingUserId query param for ownership validation
   */
  .delete(
    '/:id',
    async ({ params, query, set }) => {
      const result = await workspaceService.delete(db, params.id, query.requestingUserId);

      if (result && 'error' in result) {
        if (result.error === 'forbidden') {
          set.status = 403;
        } else if (result.error === 'bad_request') {
          set.status = 400;
        }
        return { error: result.message };
      }

      return result;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        requestingUserId: t.Optional(t.String()),
      }),
    }
  )

  /**
   * POST /workspaces/:id/clone - Clone a workspace
   * Copies workspace config (settings, templates, lists, pipelines)
   * Only workspace owner can clone
   */
  .post(
    '/:id/clone',
    async ({ params, body, set }) => {
      const result = await workspaceService.clone(
        db,
        params.id,
        body.name,
        body.ownerId
      );

      if ('error' in result) {
        if (result.error === 'forbidden') {
          set.status = 403;
        } else if (result.error === 'not_found') {
          set.status = 404;
        } else if (result.error === 'bad_request') {
          set.status = 400;
        }
        return { error: result.message };
      }

      return result;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.String({ minLength: 1 }),
        ownerId: t.String(),
      }),
      detail: {
        summary: 'Clone workspace',
        description: 'Clone a workspace with all its configuration. Only workspace owners can clone.',
      },
    }
  )

  /**
   * POST /workspaces/:id/members - Add member directly (MVP: Auto-accept)
   * No invitation token, user is added immediately to workspace
   */
  .post(
    '/:id/members',
    async ({ params, body, set }) => {
      const result = await workspaceService.addMemberDirectly(
        db,
        params.id,
        body.userId,
        body.role,
        body.invitedBy
      );

      if ('error' in result) {
        if (result.error === 'forbidden') {
          set.status = 403;
        } else if (result.error === 'bad_request') {
          set.status = 400;
        } else if (result.error === 'not_found') {
          set.status = 404;
        }
        return { error: result.message };
      }

      return result;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        userId: t.String(),
        role: t.Union([t.Literal('admin'), t.Literal('member'), t.Literal('viewer')]),
        invitedBy: t.String(),
      }),
      detail: {
        summary: 'Add member to workspace (MVP)',
        description: 'Add a user directly to a workspace with auto-accept (no invitation token flow)',
      },
    }
  )

  /**
   * POST /workspaces/:id/invitations - Send workspace invitation
   * US-API-003: Create invitation with token
   */
  .post(
    '/:id/invitations',
    async ({ params, body, set }) => {
      const result = await workspaceService.sendInvitation(
        db,
        params.id,
        body.email,
        body.role,
        body.invitedBy
      );

      if ('error' in result) {
        if (result.error === 'forbidden') {
          set.status = 403;
        } else if (result.error === 'bad_request') {
          set.status = 400;
        }
        return { error: result.message };
      }

      return result;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        email: t.String({ format: 'email' }),
        role: t.Union([t.Literal('admin'), t.Literal('member'), t.Literal('viewer')]),
        invitedBy: t.String(),
      }),
      detail: {
        summary: 'Send workspace invitation',
        description: 'Invite a user to join a workspace with a specific role. Requires admin or owner role.',
      },
    }
  )

  /**
   * GET /invitations/:token - Validate invitation token
   * US-API-003: Check if invitation is valid and not expired
   */
  .get(
    '/invitations/:token',
    async ({ params, set }) => {
      const result = await workspaceService.validateInvitation(db, params.token);

      if ('error' in result) {
        if (result.error === 'not_found') {
          set.status = 404;
        } else if (result.error === 'bad_request') {
          set.status = 400;
        }
        return { error: result.message };
      }

      return result;
    },
    {
      params: t.Object({
        token: t.String(),
      }),
      detail: {
        summary: 'Validate invitation',
        description: 'Check if an invitation token is valid and get workspace details',
      },
    }
  )

  /**
   * POST /invitations/:token/accept - Accept invitation
   * US-API-003: Accept invitation and join workspace
   */
  .post(
    '/invitations/:token/accept',
    async ({ params, body, set }) => {
      const result = await workspaceService.acceptInvitation(db, params.token, body.userId);

      if ('error' in result) {
        if (result.error === 'not_found') {
          set.status = 404;
        } else if (result.error === 'bad_request') {
          set.status = 400;
        } else if (result.error === 'forbidden') {
          set.status = 403;
        }
        return { error: result.message };
      }

      return result;
    },
    {
      params: t.Object({
        token: t.String(),
      }),
      body: t.Object({
        userId: t.String(),
      }),
      detail: {
        summary: 'Accept invitation',
        description: 'Accept a workspace invitation and become a member',
      },
    }
  )

  /**
   * PATCH /workspaces/:id/members/:userId - Update member role
   * US-API-004: Change a member's role
   */
  .patch(
    '/:id/members/:userId',
    async ({ params, body, query, set }) => {
      const result = await workspaceService.updateMemberRole(
        db,
        params.id,
        params.userId,
        body.role,
        query.requestingUserId
      );

      if ('error' in result) {
        if (result.error === 'forbidden') {
          set.status = 403;
        } else if (result.error === 'bad_request') {
          set.status = 400;
        } else if (result.error === 'not_found') {
          set.status = 404;
        }
        return { error: result.message };
      }

      return result;
    },
    {
      params: t.Object({
        id: t.String(),
        userId: t.String(),
      }),
      query: t.Object({
        requestingUserId: t.String(),
      }),
      body: t.Object({
        role: t.Union([t.Literal('admin'), t.Literal('member'), t.Literal('viewer')]),
      }),
      detail: {
        summary: 'Update member role',
        description: 'Change a workspace member\'s role. Requires admin or owner permissions.',
      },
    }
  )

  /**
   * DELETE /workspaces/:id/members/:userId - Remove member
   * US-API-004: Remove a member from workspace
   */
  .delete(
    '/:id/members/:userId',
    async ({ params, query, set }) => {
      const result = await workspaceService.removeMember(
        db,
        params.id,
        params.userId,
        query.requestingUserId
      );

      if ('error' in result) {
        if (result.error === 'forbidden') {
          set.status = 403;
        } else if (result.error === 'bad_request') {
          set.status = 400;
        } else if (result.error === 'not_found') {
          set.status = 404;
        }
        return { error: result.message };
      }

      return result;
    },
    {
      params: t.Object({
        id: t.String(),
        userId: t.String(),
      }),
      query: t.Object({
        requestingUserId: t.String(),
      }),
      detail: {
        summary: 'Remove member',
        description: 'Remove a member from the workspace. Requires admin or owner permissions.',
      },
    }
  )

  /**
   * GET /workspaces/:id/audit-log - Get workspace audit log
   * Returns paginated audit log entries with user names
   */
  .get(
    '/:id/audit-log',
    async ({ params, query }) => {
      const page = parseInt(query.page || '1', 10);
      const limit = parseInt(query.limit || '50', 10);
      const offset = (page - 1) * limit;

      const conditions: any[] = [eq(workspaceAuditLog.workspaceId, params.id)];

      if (query.action) {
        conditions.push(eq(workspaceAuditLog.action, query.action));
      }
      if (query.resourceType) {
        conditions.push(eq(workspaceAuditLog.resourceType, query.resourceType));
      }
      if (query.dateFrom) {
        conditions.push(sql`${workspaceAuditLog.createdAt} >= ${new Date(query.dateFrom)}`);
      }
      if (query.dateTo) {
        conditions.push(sql`${workspaceAuditLog.createdAt} <= ${new Date(query.dateTo + 'T23:59:59.999Z')}`);
      }

      const logs = await db
        .select({
          id: workspaceAuditLog.id,
          workspaceId: workspaceAuditLog.workspaceId,
          userId: workspaceAuditLog.userId,
          userName: users.name,
          action: workspaceAuditLog.action,
          resourceType: workspaceAuditLog.resourceType,
          resourceId: workspaceAuditLog.resourceId,
          changes: workspaceAuditLog.changes,
          metadata: sql`null`,
          createdAt: workspaceAuditLog.createdAt,
        })
        .from(workspaceAuditLog)
        .leftJoin(users, eq(workspaceAuditLog.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(workspaceAuditLog.createdAt))
        .limit(limit)
        .offset(offset);

      return { logs };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        action: t.Optional(t.String()),
        resourceType: t.Optional(t.String()),
        dateFrom: t.Optional(t.String()),
        dateTo: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get audit log',
        description: 'Get workspace audit log with pagination and filtering',
      },
    }
  )

  /**
   * GET /workspaces/:id/audit-log/export - Export audit log as CSV
   */
  .get(
    '/:id/audit-log/export',
    async ({ params, query, set }) => {
      const conditions: any[] = [eq(workspaceAuditLog.workspaceId, params.id)];

      if (query.action) {
        conditions.push(eq(workspaceAuditLog.action, query.action));
      }
      if (query.resourceType) {
        conditions.push(eq(workspaceAuditLog.resourceType, query.resourceType));
      }
      if (query.dateFrom) {
        conditions.push(sql`${workspaceAuditLog.createdAt} >= ${new Date(query.dateFrom)}`);
      }
      if (query.dateTo) {
        conditions.push(sql`${workspaceAuditLog.createdAt} <= ${new Date(query.dateTo + 'T23:59:59.999Z')}`);
      }

      const logs = await db
        .select({
          id: workspaceAuditLog.id,
          userId: workspaceAuditLog.userId,
          userName: users.name,
          action: workspaceAuditLog.action,
          resourceType: workspaceAuditLog.resourceType,
          resourceId: workspaceAuditLog.resourceId,
          changes: workspaceAuditLog.changes,
          createdAt: workspaceAuditLog.createdAt,
        })
        .from(workspaceAuditLog)
        .leftJoin(users, eq(workspaceAuditLog.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(workspaceAuditLog.createdAt))
        .limit(10000);

      // Build CSV
      const header = 'Date,User,Action,Resource Type,Resource ID,Changes\n';
      const rows = logs.map((log) => {
        const date = log.createdAt ? new Date(log.createdAt).toISOString() : '';
        const user = (log.userName || 'Unknown').replace(/"/g, '""');
        const action = (log.action || '').replace(/"/g, '""');
        const resourceType = (log.resourceType || '').replace(/"/g, '""');
        const resourceId = log.resourceId || '';
        const changes = log.changes ? JSON.stringify(log.changes).replace(/"/g, '""') : '';
        return `"${date}","${user}","${action}","${resourceType}","${resourceId}","${changes}"`;
      }).join('\n');

      set.headers['Content-Type'] = 'text/csv';
      set.headers['Content-Disposition'] = `attachment; filename="audit-log-${params.id}.csv"`;

      return header + rows;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        action: t.Optional(t.String()),
        resourceType: t.Optional(t.String()),
        dateFrom: t.Optional(t.String()),
        dateTo: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Export audit log',
        description: 'Export workspace audit log as CSV',
      },
    }
  )

  /**
   * GET /workspaces/stream - Stream workspace changes via SSE
   *
   * Real-time updates for workspace changes using ElectricSQL
   */
  .get('/stream', async function* ({ set }) {
    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';

    const subscriptionTimestamp = new Date();

    console.log(`[workspaces/stream] Starting stream at ${subscriptionTimestamp.toISOString()}`);

    // Send initial connection confirmation
    yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

    try {
      const electric = streamWorkspaces(subscriptionTimestamp);

      for await (const sseMessage of electric.stream()) {
        yield sseMessage;
      }
    } catch (error) {
      console.error('[workspaces/stream] Error:', error);
      yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
    }
  });
