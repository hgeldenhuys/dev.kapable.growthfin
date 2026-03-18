/**
 * Tasks Tests
 * Test task creation, state transitions, filtering, and deletion rules
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { config } from 'dotenv';

// Load environment variables
config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test data
let testWorkspaceId: string;
let testListId: string;
let testUserId: string;
let testBatchId: string;

describe('Tasks API', () => {
  beforeAll(async () => {
    // Get test workspace from environment or use a known test workspace
    testWorkspaceId = process.env.TEST_WORKSPACE_ID || 'test-workspace-id';
    testUserId = process.env.TEST_USER_ID || 'test-user-id';

    // Create a test list for tasks
    const listResponse = await fetch(`${API_URL}/api/v1/crm/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
        name: 'Tasks Test List',
        description: 'Test list for task operations',
        type: 'manual',
        entityType: 'contact',
        createdBy: testUserId,
      }),
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();
      testListId = listData.list.id;
    } else {
      console.warn('Failed to create test list, using fallback ID');
      testListId = 'test-list-id';
    }
  });

  test('POST /tasks - Create enrichment task', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
        listId: testListId,
        type: 'enrichment',
        name: 'Test Enrichment Task',
        description: 'Test enrichment with AI',
        configuration: {
          templateId: 'test-template-id',
          budgetLimit: 10.0,
        },
        createdBy: testUserId,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.task).toBeDefined();
    expect(data.task.type).toBe('enrichment');
    expect(data.task.status).toBe('planned');
    expect(data.task.name).toBe('Test Enrichment Task');
    expect(data.task.configuration.templateId).toBe('test-template-id');

    testBatchId = data.task.id;
  });

  test('POST /tasks - Create export task', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
        listId: testListId,
        type: 'export',
        name: 'Test Export Task',
        configuration: {
          format: 'csv',
          fields: ['name', 'email', 'phone'],
        },
        createdBy: testUserId,
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.task.type).toBe('export');
  });

  test('POST /tasks - Reject invalid enrichment configuration', async () => {
    const response = await fetch(`${API_URL}/api/v1/crm/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
        listId: testListId,
        type: 'enrichment',
        name: 'Invalid Task',
        configuration: {
          // Missing templateId
          budgetLimit: 10.0,
        },
        createdBy: testUserId,
      }),
    });

    const data = await response.json();

    // Should fail validation
    expect(data.success).toBe(false);
  });

  test('GET /tasks/:id - Get task by ID', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches/${testBatchId}?workspaceId=${testWorkspaceId}`
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.task).toBeDefined();
    expect(data.task.id).toBe(testBatchId);
  });

  test('GET /tasks - List all tasks for workspace', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches?workspaceId=${testWorkspaceId}`
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(2); // At least 2 tasks created
  });

  test('GET /tasks - Filter by type', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches?workspaceId=${testWorkspaceId}&type=enrichment`
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tasks.every((t: any) => t.type === 'enrichment')).toBe(true);
  });

  test('GET /tasks - Filter by status', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches?workspaceId=${testWorkspaceId}&status=planned`
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tasks.every((t: any) => t.status === 'planned')).toBe(true);
  });

  test('GET /tasks - Filter by listId', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches?workspaceId=${testWorkspaceId}&listId=${testListId}`
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tasks.every((t: any) => t.listId === testListId)).toBe(true);
  });

  test('PUT /tasks/:id - Update task name and description', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches/${testBatchId}?workspaceId=${testWorkspaceId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Task Name',
          description: 'Updated description',
          updatedBy: testUserId,
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.task.name).toBe('Updated Task Name');
    expect(data.task.description).toBe('Updated description');
  });

  test('PUT /tasks/:id/status - Valid state transition (planned → scheduled)', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches/${testBatchId}/status?workspaceId=${testWorkspaceId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'scheduled',
          updatedBy: testUserId,
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.task.status).toBe('scheduled');
  });

  test('PUT /tasks/:id/status - Valid state transition (scheduled → running)', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches/${testBatchId}/status?workspaceId=${testWorkspaceId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'running',
          updatedBy: testUserId,
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.task.status).toBe('running');
    expect(data.task.startedAt).toBeDefined(); // startedAt should be set
  });

  test('PUT /tasks/:id/status - Valid state transition (running → completed)', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches/${testBatchId}/status?workspaceId=${testWorkspaceId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          updatedBy: testUserId,
        }),
      }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.task.status).toBe('completed');
    expect(data.task.completedAt).toBeDefined(); // completedAt should be set
  });

  test('PUT /tasks/:id/status - Invalid state transition (completed → running)', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches/${testBatchId}/status?workspaceId=${testWorkspaceId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'running',
          updatedBy: testUserId,
        }),
      }
    );

    const data = await response.json();

    // Should fail - completed is a terminal state
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid state transition');
  });

  test('DELETE /tasks/:id - Cannot delete completed task', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/batches/${testBatchId}?workspaceId=${testWorkspaceId}`,
      {
        method: 'DELETE',
      }
    );

    const data = await response.json();

    // Should fail - can only delete planned tasks
    expect(data.success).toBe(false);
    expect(data.error).toContain('Cannot delete task with status: completed');
  });

  test('DELETE /tasks/:id - Can delete planned task', async () => {
    // Create a new planned task
    const createResponse = await fetch(`${API_URL}/api/v1/crm/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
        listId: testListId,
        type: 'enrichment',
        name: 'Task to Delete',
        configuration: {
          templateId: 'test-template-id',
        },
        createdBy: testUserId,
      }),
    });

    const createData = await createResponse.json();
    const taskToDeleteId = createData.task.id;

    // Delete it
    const deleteResponse = await fetch(
      `${API_URL}/api/v1/crm/batches/${taskToDeleteId}?workspaceId=${testWorkspaceId}`,
      {
        method: 'DELETE',
      }
    );

    const deleteData = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteData.success).toBe(true);

    // Verify it's deleted
    const getResponse = await fetch(
      `${API_URL}/api/v1/crm/batches/${taskToDeleteId}?workspaceId=${testWorkspaceId}`
    );

    const getData = await getResponse.json();
    expect(getData.task).toBeNull();
  });

  test('State transitions - Full lifecycle test', async () => {
    // Create task
    const createResponse = await fetch(`${API_URL}/api/v1/crm/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: testWorkspaceId,
        listId: testListId,
        type: 'enrichment',
        name: 'Lifecycle Test Task',
        configuration: {
          templateId: 'test-template-id',
        },
        createdBy: testUserId,
      }),
    });

    const createData = await createResponse.json();
    const taskId = createData.task.id;

    // Test valid transitions
    const validTransitions = [
      { from: 'planned', to: 'scheduled' },
      { from: 'scheduled', to: 'running' },
      { from: 'running', to: 'failed' },
      { from: 'failed', to: 'planned' }, // Can retry failed tasks
      { from: 'planned', to: 'cancelled' }, // Can cancel planned tasks
    ];

    for (let i = 0; i < validTransitions.length; i++) {
      const transition = validTransitions[i];

      const response = await fetch(
        `${API_URL}/api/v1/crm/batches/${taskId}/status?workspaceId=${testWorkspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: transition.to,
            updatedBy: testUserId,
          }),
        }
      );

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.task.status).toBe(transition.to);
    }
  });
});
