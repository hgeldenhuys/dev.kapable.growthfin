/**
 * Manual Score Recalculation API Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { config } from 'dotenv';

// Load environment variables
config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test data
let testWorkspaceId: string;
let testUserId: string;
let testLeadId: string;

describe('POST /api/v1/crm/leads/:leadId/recalculate-score', () => {
  beforeAll(async () => {
    // Create test workspace
    const workspaceRes = await fetch(`${API_URL}/api/v1/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Workspace Score',
        slug: 'test-workspace-score',
      }),
    });
    const workspace = await workspaceRes.json();
    testWorkspaceId = workspace.id;

    // Create test user (simplified - in real app would use auth)
    testUserId = '00000000-0000-0000-0000-000000000001'; // Mock user

    // Create test lead
    const leadRes = await fetch(
      `${API_URL}/api/v1/crm/leads?workspaceId=${testWorkspaceId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: testWorkspaceId,
          firstName: 'Jane',
          lastName: 'Smith',
          companyName: 'Tech Corp',
          email: 'jane@techcorp.com',
          phone: '+1987654321',
          source: 'referral',
          status: 'new',
          ownerId: testUserId,
          createdBy: testUserId,
          updatedBy: testUserId,
        }),
      }
    );
    const lead = await leadRes.json();
    testLeadId = lead.id;
  });

  afterAll(async () => {
    // Cleanup
    await fetch(
      `${API_URL}/api/v1/crm/leads/${testLeadId}?workspaceId=${testWorkspaceId}`,
      {
        method: 'DELETE',
      }
    );
    await fetch(`${API_URL}/api/v1/workspaces/${testWorkspaceId}`, {
      method: 'DELETE',
    });
  });

  it('should queue manual score recalculation job', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/leads/${testLeadId}/recalculate-score?workspaceId=${testWorkspaceId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: testWorkspaceId,
          userId: testUserId,
          reason: 'Testing manual recalculation',
        }),
      }
    );

    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.message).toBe('Score recalculation queued');
    expect(result.jobId).toBeDefined();
    expect(result.leadId).toBe(testLeadId);
  });

  it('should return error for non-existent lead', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/leads/00000000-0000-0000-0000-000000000000/recalculate-score?workspaceId=${testWorkspaceId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: testWorkspaceId,
          userId: testUserId,
        }),
      }
    );

    expect(response.status).toBe(500);
    const result = await response.json();
    expect(result.error).toBeDefined();
  });

  it('should accept optional reason parameter', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/leads/${testLeadId}/recalculate-score?workspaceId=${testWorkspaceId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: testWorkspaceId,
          userId: testUserId,
          reason: 'User requested update',
        }),
      }
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
  });

  it('should work without reason parameter', async () => {
    const response = await fetch(
      `${API_URL}/api/v1/crm/leads/${testLeadId}/recalculate-score?workspaceId=${testWorkspaceId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: testWorkspaceId,
          userId: testUserId,
        }),
      }
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
  });
});
