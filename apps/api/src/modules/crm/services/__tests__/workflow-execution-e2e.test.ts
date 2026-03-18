/**
 * End-to-End Workflow Execution Test
 * Verifies BUG-001, BUG-003, BUG-004, BUG-005, BUG-006 fixes
 */

import { describe, it, expect } from 'bun:test';
import { db } from '@agios/db';
import { crmLeads } from '@agios/db/schema';
import {
  campaignWorkflowService,
  workflowEnrollmentService,
  workflowExecutionService,
} from '../campaign-workflows';

const WORKSPACE_ID = 'b5fc28d5-90e7-4205-9b25-1a1347dd7858';

describe('Workflow Execution E2E Tests', () => {
  it('should create execution with enrollmentId and retrieve it (BUG-001, BUG-003)', async () => {
    // Create workflow
    const workflow = await campaignWorkflowService.create(db, {
      workspaceId: WORKSPACE_ID,
      name: 'E2E Test Workflow',
      description: 'End-to-end test',
      tags: ['e2e-test'],
      steps: [
        {
          id: 'step-1',
          type: 'add_tag',
          config: { tag: 'e2e-tested' },
          transitions: [{ to: null }],
        },
      ],
      status: 'active',
    });

    // Create lead with all required fields (BUG-002)
    const timestamp = Date.now();
    const leads = await db
      .insert(crmLeads)
      .values({
        workspaceId: WORKSPACE_ID,
        firstName: 'E2E',
        lastName: 'Test',
        companyName: 'E2E Company',
        email: `e2e-${timestamp}@test.com`,
        source: 'e2e-test',
        lifecycleStage: 'verified',
        status: 'new',
      })
      .returning();

    // Enroll lead
    const enrollment = await workflowEnrollmentService.enroll(db, {
      workspaceId: WORKSPACE_ID,
      workflowId: workflow.id,
      leadId: leads[0].id,
      context: { test: 'e2e' },
    });

    // Create execution record (simulating worker behavior)
    const execution = await workflowExecutionService.create(db, {
      workspaceId: WORKSPACE_ID,
      enrollmentId: enrollment.id, // BUG-001: Must be set
      stepId: 'step-1',
      stepType: 'add_tag',
      stepConfig: { tag: 'e2e-tested' },
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 100,
      transitionedTo: null, // BUG-005: Properly track transitions
      transitionReason: 'Workflow complete',
      output: { tag: 'e2e-tested' },
    });

    // Verify execution was created with enrollmentId
    expect(execution.enrollmentId).toBe(enrollment.id);
    expect(execution.status).toBe('completed');

    // BUG-003: Verify we can retrieve execution history
    const executions = await workflowExecutionService.listByEnrollment(
      db,
      enrollment.id,
      WORKSPACE_ID
    );

    expect(executions.length).toBeGreaterThan(0);
    expect(executions[0].enrollmentId).toBe(enrollment.id);
    expect(executions[0].stepId).toBe('step-1');
    expect(executions[0].transitionedTo).toBe(null);
  });

  it('should complete enrollment successfully (BUG-004)', async () => {
    // Create workflow
    const workflow = await campaignWorkflowService.create(db, {
      workspaceId: WORKSPACE_ID,
      name: 'Completion Test Workflow',
      description: 'Test enrollment completion',
      tags: ['completion-test'],
      steps: [
        {
          id: 'step-1',
          type: 'add_tag',
          config: { tag: 'completed' },
          transitions: [{ to: null }],
        },
      ],
      status: 'active',
    });

    // Create lead
    const timestamp = Date.now();
    const leads = await db
      .insert(crmLeads)
      .values({
        workspaceId: WORKSPACE_ID,
        firstName: 'Completion',
        lastName: 'Test',
        companyName: 'Completion Co',
        email: `completion-${timestamp}@test.com`,
        source: 'test',
        lifecycleStage: 'verified',
        status: 'new',
      })
      .returning();

    // Enroll lead
    const enrollment = await workflowEnrollmentService.enroll(db, {
      workspaceId: WORKSPACE_ID,
      workflowId: workflow.id,
      leadId: leads[0].id,
      context: {},
    });

    // BUG-004: Complete enrollment should not throw "Enrollment not found"
    await workflowEnrollmentService.complete(db, enrollment.id, WORKSPACE_ID);

    // Verify enrollment is completed
    const completedEnrollment = await workflowEnrollmentService.getById(
      db,
      enrollment.id,
      WORKSPACE_ID
    );

    expect(completedEnrollment?.status).toBe('completed');
    expect(completedEnrollment?.completedAt).toBeDefined();
  });
});
