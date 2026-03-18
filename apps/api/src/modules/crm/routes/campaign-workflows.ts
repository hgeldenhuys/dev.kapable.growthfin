/**
 * Campaign Workflows Routes
 * US-CAMPAIGN-WORKFLOW-007: Multi-Step Workflow Builder
 * US-CAMPAIGN-WORKFLOW-008: Workflow Execution Engine
 */

import { Elysia, t } from 'elysia';
import { db } from '@agios/db';
import {
  campaignWorkflowService,
  workflowEnrollmentService,
  workflowExecutionService,
} from '../services/campaign-workflows';
import { createSignalDBStream } from '../../../lib/signaldb-stream';

export const campaignWorkflowsRoutes = new Elysia({ prefix: '/campaign-workflows' })
  // ============================================================================
  // WORKFLOWS - RECENT & STREAMING (CQRS Pattern)
  // ============================================================================

  .get(
    '/recent',
    async ({ query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400;
      const workflows = await campaignWorkflowService.getRecent(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
        workflows,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Get recent workflows',
        description: 'Fetch recent workflows for initial state (CQRS pattern)',
      },
    }
  )

  .get(
    '/stream',
    async function* ({ query, set }) {
      set.headers['Content-Type'] = 'text/event-stream';
      set.headers['Cache-Control'] = 'no-cache';
      set.headers['Connection'] = 'keep-alive';

      const subscriptionTimestamp = new Date();

      console.log(`[campaign-workflows/stream] Starting stream for workspace ${query.workspaceId}`);

      yield `: connected at ${subscriptionTimestamp.toISOString()}\n\n`;

      try {
        const stream = createSignalDBStream({
          table: 'campaign_workflows',
          where: `workspace_id='${query.workspaceId}'`,
          subscriptionTimestamp,
        });

        for await (const sseMessage of stream.stream()) {
          yield sseMessage;
        }
      } catch (error) {
        console.error('[campaign-workflows/stream] Error:', error);
        yield `data: ${JSON.stringify({ error: 'Stream error', message: String(error) })}\n\n`;
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Stream workflow updates',
        description: 'Stream NEW workflow updates via ElectricSQL (REACTIVE, NO POLLING)',
      },
    }
  )

  // ============================================================================
  // WORKFLOWS - CRUD OPERATIONS
  // ============================================================================

  .get(
    '/',
    async ({ query }) => {
      const result = await campaignWorkflowService.list(db, query.workspaceId, {
        status: query.status as any,
        tags: query.tags ? JSON.parse(query.tags) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return result;
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        status: t.Optional(t.String()),
        tags: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'List workflows',
        description: 'Get all workflows with optional filtering',
      },
    }
  )

  .get(
    '/:id',
    async ({ params, query }) => {
      const workflow = await campaignWorkflowService.getById(db, params.id, query.workspaceId);

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      return workflow;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Get workflow by ID',
      },
    }
  )

  .post(
    '/',
    async ({ body }) => {
      const workflow = await campaignWorkflowService.create(db, body);

      return workflow;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        name: t.String(),
        description: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        steps: t.Any(), // JSONB workflow definition
        entryConditions: t.Optional(t.Any()),
        exitConditions: t.Optional(t.Any()),
        status: t.Optional(t.String()),
        createdBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Create workflow',
        description: 'Create a new campaign workflow',
      },
    }
  )

  .put(
    '/:id',
    async ({ params, query, body }) => {
      const workflow = await campaignWorkflowService.update(
        db,
        params.id,
        query.workspaceId,
        body
      );

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      return workflow;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        steps: t.Optional(t.Any()),
        entryConditions: t.Optional(t.Any()),
        exitConditions: t.Optional(t.Any()),
        status: t.Optional(t.String()),
        updatedBy: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Update workflow',
      },
    }
  )

  .post(
    '/:id/activate',
    async ({ params, query }) => {
      const workflow = await campaignWorkflowService.activate(db, params.id, query.workspaceId);

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      return workflow;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Activate workflow',
        description: 'Change workflow status to active',
      },
    }
  )

  .post(
    '/:id/pause',
    async ({ params, query }) => {
      const workflow = await campaignWorkflowService.pause(db, params.id, query.workspaceId);

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      return workflow;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Pause workflow',
        description: 'Change workflow status to paused',
      },
    }
  )

  .delete(
    '/:id',
    async ({ params, query }) => {
      const success = await campaignWorkflowService.delete(db, params.id, query.workspaceId);

      if (!success) {
        throw new Error('Workflow not found');
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Delete workflow',
        description: 'Soft delete a workflow',
      },
    }
  )

  // ============================================================================
  // ENROLLMENTS
  // ============================================================================

  .get(
    '/:id/enrollments',
    async ({ params, query }) => {
      const result = await workflowEnrollmentService.listByWorkflow(
        db,
        params.id,
        query.workspaceId,
        {
          status: query.status,
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
          offset: query.offset ? parseInt(query.offset, 10) : undefined,
        }
      );

      return result;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
        status: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'List workflow enrollments',
        description: 'Get all enrollments for a workflow',
      },
    }
  )

  .post(
    '/:id/enroll',
    async ({ params, query, body }) => {
      const enrollment = await workflowEnrollmentService.enroll(db, {
        workspaceId: query.workspaceId,
        workflowId: params.id,
        leadId: body.leadId,
        context: body.context || {},
      });

      return enrollment;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      body: t.Object({
        leadId: t.String(),
        context: t.Optional(t.Any()),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Enroll lead in workflow',
        description: 'Enroll a lead into a workflow',
      },
    }
  )

  .get(
    '/enrollments/:enrollmentId',
    async ({ params, query }) => {
      const enrollment = await workflowEnrollmentService.getById(
        db,
        params.enrollmentId,
        query.workspaceId
      );

      if (!enrollment) {
        throw new Error('Enrollment not found');
      }

      return enrollment;
    },
    {
      params: t.Object({
        enrollmentId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Get enrollment by ID',
      },
    }
  )

  .post(
    '/enrollments/:enrollmentId/complete',
    async ({ params, query }) => {
      await workflowEnrollmentService.complete(db, params.enrollmentId, query.workspaceId);

      return { success: true };
    },
    {
      params: t.Object({
        enrollmentId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Complete enrollment',
        description: 'Mark enrollment as completed',
      },
    }
  )

  .post(
    '/enrollments/:enrollmentId/cancel',
    async ({ params, query }) => {
      await workflowEnrollmentService.cancel(db, params.enrollmentId, query.workspaceId);

      return { success: true };
    },
    {
      params: t.Object({
        enrollmentId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Cancel enrollment',
        description: 'Cancel an active enrollment',
      },
    }
  )

  // ============================================================================
  // EXECUTION HISTORY
  // ============================================================================

  .get(
    '/enrollments/:enrollmentId/executions',
    async ({ params, query }) => {
      const executions = await workflowExecutionService.listByEnrollment(
        db,
        params.enrollmentId,
        query.workspaceId
      );

      return { executions };
    },
    {
      params: t.Object({
        enrollmentId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.String(),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Get execution history',
        description: 'Get execution history for an enrollment',
      },
    }
  )

  .get(
    '/executions/recent',
    async ({ query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 3600;
      const executions = await workflowExecutionService.getRecent(db, query.workspaceId, seconds);

      return { executions };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Get recent executions',
        description: 'Get recent workflow step executions for monitoring',
      },
    }
  )

  .get(
    '/executions/failed',
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit, 10) : 100;
      const executions = await workflowExecutionService.getFailedExecutions(
        db,
        query.workspaceId,
        limit
      );

      return { executions };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Campaign Workflows'],
        summary: 'Get failed executions',
        description: 'Get failed workflow step executions for error analysis',
      },
    }
  );
