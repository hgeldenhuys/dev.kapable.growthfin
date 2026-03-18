import { config } from 'dotenv';
config();

/**
 * Workspace API Tests
 * US-API-001: List user's workspaces
 * US-API-002: Get workspace details
 */

import { describe, test, expect, beforeAll } from 'bun:test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test data setup
let testUserId: string;
let testWorkspaceId: string;
let nonMemberUserId: string;

describe('Workspace API', () => {
  beforeAll(async () => {
    // Note: In a real test environment, you would set up test data here
    // For now, we'll use existing test data from the database
    testUserId = 'bea5f24c-d154-466b-8920-a73596f1f7ab';
    testWorkspaceId = '9d753529-cc68-4a23-9063-68ac0e952403';
    nonMemberUserId = '3f2e42be-6575-42fa-b407-d943f1348973';
  });

  describe('US-API-001: List user workspaces', () => {
    test('should return all workspaces where user is a member', async () => {
      const response = await fetch(`${API_URL}/api/v1/workspaces?userId=${testUserId}`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('workspaces');
      expect(Array.isArray(data.workspaces)).toBe(true);
    });

    test('should include user role in each workspace', async () => {
      const response = await fetch(`${API_URL}/api/v1/workspaces?userId=${testUserId}`);
      const data = await response.json();

      if (data.workspaces.length > 0) {
        const workspace = data.workspaces[0];
        expect(workspace).toHaveProperty('role');
        expect(['owner', 'admin', 'member', 'viewer']).toContain(workspace.role);
      }
    });

    test('should include member count for each workspace', async () => {
      const response = await fetch(`${API_URL}/api/v1/workspaces?userId=${testUserId}`);
      const data = await response.json();

      if (data.workspaces.length > 0) {
        const workspace = data.workspaces[0];
        expect(workspace).toHaveProperty('memberCount');
        expect(typeof workspace.memberCount).toBe('number');
        expect(workspace.memberCount).toBeGreaterThan(0);
      }
    });

    test('should return 200 with workspace array', async () => {
      const response = await fetch(`${API_URL}/api/v1/workspaces?userId=${testUserId}`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data.workspaces)).toBe(true);
    });

    test('should include all required fields in response', async () => {
      const response = await fetch(`${API_URL}/api/v1/workspaces?userId=${testUserId}`);
      const data = await response.json();

      if (data.workspaces.length > 0) {
        const workspace = data.workspaces[0];
        expect(workspace).toHaveProperty('id');
        expect(workspace).toHaveProperty('name');
        expect(workspace).toHaveProperty('slug');
        expect(workspace).toHaveProperty('role');
        expect(workspace).toHaveProperty('memberCount');
        expect(workspace).toHaveProperty('createdAt');
      }
    });

    test('should require userId parameter', async () => {
      const response = await fetch(`${API_URL}/api/v1/workspaces`);
      expect(response.status).toBe(400);
    });
  });

  describe('US-API-002: Get workspace details', () => {
    test('should return workspace details with member list', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}?userId=${testUserId}`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('workspace');
      expect(data.workspace).toHaveProperty('members');
      expect(Array.isArray(data.workspace.members)).toBe(true);
    });

    test('should include each member role and status', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}?userId=${testUserId}`
      );
      const data = await response.json();

      if (data.workspace.members.length > 0) {
        const member = data.workspace.members[0];
        expect(member).toHaveProperty('role');
        expect(member).toHaveProperty('status');
        expect(member).toHaveProperty('email');
        expect(member).toHaveProperty('name');
        expect(member).toHaveProperty('userId');
        expect(member).toHaveProperty('joinedAt');
      }
    });

    test('should return 200 with workspace object', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}?userId=${testUserId}`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.workspace).toHaveProperty('id');
      expect(data.workspace).toHaveProperty('name');
      expect(data.workspace).toHaveProperty('slug');
      expect(data.workspace).toHaveProperty('ownerId');
      expect(data.workspace).toHaveProperty('createdAt');
      expect(data.workspace).toHaveProperty('settings');
    });

    test('should return 403 if user not a member', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}?userId=${nonMemberUserId}`
      );
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('should return 404 if workspace does not exist', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${nonExistentId}?userId=${testUserId}`
      );
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('should require userId parameter', async () => {
      const response = await fetch(`${API_URL}/api/v1/workspaces/${testWorkspaceId}`);
      expect(response.status).toBe(400);
    });

    test('should require workspace membership', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}?userId=${nonMemberUserId}`
      );
      expect(response.status).toBe(403);
    });
  });
});
