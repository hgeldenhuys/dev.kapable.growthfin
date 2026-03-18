/**
 * Campaign Workflows Integration Tests
 * US-CAMPAIGN-WORKFLOW-007: Multi-Step Workflow Builder
 * US-CAMPAIGN-WORKFLOW-008: Workflow Execution Engine
 */

import { describe, it, expect } from 'bun:test';
import { db } from '@agios/db';
import { crmLeads } from '@agios/db/schema';
import {
  campaignWorkflowService,
  workflowEnrollmentService,
  workflowExecutionService,
} from '../../services/campaign-workflows';

const WORKSPACE_ID = 'b5fc28d5-90e7-4205-9b25-1a1347dd7858';

describe('Campaign Workflows Service', () => {
  let createdWorkflowId: string;
  let createdEnrollmentId: string;
  let testLeadId: string;

  it('should create a workflow', async () => {
    const workflow = await campaignWorkflowService.create(db, {
      workspaceId: WORKSPACE_ID,
      name: 'Test Nurture Workflow',
      description: 'Test workflow for lead nurturing',
      tags: ['test', 'nurture'],
      steps: [
        {
          id: 'step-1',
          type: 'wait',
          config: { duration: 1, unit: 'days' },
          transitions: [{ to: 'step-2' }],
        },
        {
          id: 'step-2',
          type: 'add_tag',
          config: { tag: 'nurtured' },
          transitions: [{ to: null }],
        },
      ],
      status: 'draft',
    });

    expect(workflow.id).toBeDefined();
    expect(workflow.name).toBe('Test Nurture Workflow');
    expect(workflow.steps).toHaveLength(2);
    expect(workflow.enrollmentCount).toBe(0);

    createdWorkflowId = workflow.id;
  });

  it('should list workflows', async () => {
    const { workflows, total } = await campaignWorkflowService.list(db, WORKSPACE_ID);

    expect(total).toBeGreaterThan(0);
    expect(workflows.some((w) => w.id === createdWorkflowId)).toBe(true);
  });

  it('should activate workflow', async () => {
    const activated = await campaignWorkflowService.activate(db, createdWorkflowId, WORKSPACE_ID);

    expect(activated).toBeDefined();
    expect(activated?.status).toBe('active');
  });

  it('should pause workflow', async () => {
    const paused = await campaignWorkflowService.pause(db, createdWorkflowId, WORKSPACE_ID);

    expect(paused).toBeDefined();
    expect(paused?.status).toBe('paused');

    // Re-activate for enrollment test
    await campaignWorkflowService.activate(db, createdWorkflowId, WORKSPACE_ID);
  });

  it('should enroll a lead in workflow', async () => {
    // BUG-002 FIX: Create a test lead with required companyName field
    const leads = await db
      .insert(crmLeads)
      .values({
        workspaceId: WORKSPACE_ID,
        firstName: 'Test',
        lastName: 'Lead',
        companyName: 'Test Company', // Required field per schema
        email: `test-workflow-${Date.now()}@example.com`,
        source: 'test', // Required field per schema
        lifecycleStage: 'verified',
        status: 'new',
      })
      .returning();

    testLeadId = leads[0].id;

    const enrollment = await workflowEnrollmentService.enroll(db, {
      workspaceId: WORKSPACE_ID,
      workflowId: createdWorkflowId,
      leadId: testLeadId,
      context: { source: 'test' },
    });

    expect(enrollment.id).toBeDefined();
    expect(enrollment.workflowId).toBe(createdWorkflowId);
    expect(enrollment.leadId).toBe(testLeadId);
    expect(enrollment.status).toBe('active');
    expect(enrollment.context).toEqual({ source: 'test' });

    createdEnrollmentId = enrollment.id;
  });

  it('should prevent duplicate active enrollments', async () => {
    expect(async () => {
      await workflowEnrollmentService.enroll(db, {
        workspaceId: WORKSPACE_ID,
        workflowId: createdWorkflowId,
        leadId: testLeadId,
        context: {},
      });
    }).toThrow();
  });

  it('should list enrollments for workflow', async () => {
    const { enrollments, total } = await workflowEnrollmentService.listByWorkflow(
      db,
      createdWorkflowId,
      WORKSPACE_ID
    );

    expect(total).toBeGreaterThan(0);
    expect(enrollments.some((e) => e.id === createdEnrollmentId)).toBe(true);
  });

  it('should list enrollments for lead', async () => {
    const enrollments = await workflowEnrollmentService.listByLead(db, testLeadId, WORKSPACE_ID);

    expect(enrollments.length).toBeGreaterThan(0);
    expect(enrollments.some((e) => e.id === createdEnrollmentId)).toBe(true);
  });

  it('should create execution records', async () => {
    const execution = await workflowExecutionService.create(db, {
      workspaceId: WORKSPACE_ID,
      enrollmentId: createdEnrollmentId,
      stepId: 'step-1',
      stepType: 'wait',
      stepConfig: { duration: 1, unit: 'days' },
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 100,
      transitionedTo: 'step-2',
      transitionReason: 'Wait completed',
      output: { delay: 86400000 },
    });

    expect(execution.id).toBeDefined();
    expect(execution.enrollmentId).toBe(createdEnrollmentId);
    expect(execution.stepId).toBe('step-1');
  });

  it('should get execution history for enrollment', async () => {
    const executions = await workflowExecutionService.listByEnrollment(
      db,
      createdEnrollmentId,
      WORKSPACE_ID
    );

    expect(executions.length).toBeGreaterThan(0);
    expect(executions[0].stepId).toBe('step-1');
  });

  it('should complete enrollment', async () => {
    await workflowEnrollmentService.complete(db, createdEnrollmentId, WORKSPACE_ID);

    const enrollment = await workflowEnrollmentService.getById(
      db,
      createdEnrollmentId,
      WORKSPACE_ID
    );

    expect(enrollment?.status).toBe('completed');
    expect(enrollment?.completedAt).toBeDefined();
  });

  it('should soft delete workflow', async () => {
    const success = await campaignWorkflowService.delete(db, createdWorkflowId, WORKSPACE_ID);
    expect(success).toBe(true);
  });
});
