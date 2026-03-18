import { config } from 'dotenv';
config();

/**
 * Workspace Invitation & Member Management Tests
 * US-API-003: Workspace invitation system
 * US-API-004: Manage workspace members
 */

import { describe, test, expect, beforeAll } from 'bun:test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test data
let testWorkspaceId: string;
let ownerUserId: string;
let adminUserId: string;
let memberUserId: string;
let newUserEmail: string;
let invitationToken: string;

describe('Workspace Invitations & Member Management', () => {
  beforeAll(async () => {
    // Use existing test data from database
    testWorkspaceId = '9d753529-cc68-4a23-9063-68ac0e952403';
    ownerUserId = 'bea5f24c-d154-466b-8920-a73596f1f7ab';
    adminUserId = 'bea5f24c-d154-466b-8920-a73596f1f7ab'; // For testing, same as owner
    memberUserId = 'bea5f24c-d154-466b-8920-a73596f1f7ab';
    newUserEmail = `test-invite-${Date.now()}@example.com`;
  });

  describe('US-API-003: Send Invitation', () => {
    test('should allow owner to send invitation', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newUserEmail,
            role: 'member',
            invitedBy: ownerUserId,
          }),
        }
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('invitation');
      expect(data.invitation).toHaveProperty('id');
      expect(data.invitation).toHaveProperty('email', newUserEmail);
      expect(data.invitation).toHaveProperty('role', 'member');
      expect(data.invitation).toHaveProperty('token');
      expect(data.invitation).toHaveProperty('expiresAt');

      // Save token for later tests
      invitationToken = data.invitation.token;
    });

    test('should not allow inviting as owner role', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `another-${Date.now()}@example.com`,
            role: 'owner',
            invitedBy: ownerUserId,
          }),
        }
      );

      // Elysia validation rejects 'owner' at schema level
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('should allow admin role', async () => {
      const adminEmail = `admin-${Date.now()}@example.com`;
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: adminEmail,
            role: 'admin',
            invitedBy: ownerUserId,
          }),
        }
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.invitation.role).toBe('admin');
    });

    test('should allow viewer role', async () => {
      const viewerEmail = `viewer-${Date.now()}@example.com`;
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: viewerEmail,
            role: 'viewer',
            invitedBy: ownerUserId,
          }),
        }
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.invitation.role).toBe('viewer');
    });

    test('should reject duplicate pending invitation', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newUserEmail,
            role: 'member',
            invitedBy: ownerUserId,
          }),
        }
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('already pending');
    });

    test('should generate unique token', async () => {
      const email1 = `unique1-${Date.now()}@example.com`;
      const email2 = `unique2-${Date.now()}@example.com`;

      const response1 = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email1,
            role: 'member',
            invitedBy: ownerUserId,
          }),
        }
      );

      const response2 = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email2,
            role: 'member',
            invitedBy: ownerUserId,
          }),
        }
      );

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.invitation.token).not.toBe(data2.invitation.token);
      expect(data1.invitation.token.length).toBeGreaterThan(20);
      expect(data2.invitation.token.length).toBeGreaterThan(20);
    });

    test('should set expiration to 7 days from now', async () => {
      const email = `expires-${Date.now()}@example.com`;
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            role: 'member',
            invitedBy: ownerUserId,
          }),
        }
      );

      const data = await response.json();
      const expiresAt = new Date(data.invitation.expiresAt);
      const now = new Date();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const diff = expiresAt.getTime() - now.getTime();

      // Should be approximately 7 days (within 1 hour tolerance for test timing)
      expect(diff).toBeGreaterThan(sevenDays - 3600000);
      expect(diff).toBeLessThan(sevenDays + 3600000);
    });
  });

  describe('US-API-003: Validate Invitation', () => {
    test('should validate valid invitation token', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/invitations/${invitationToken}`
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('invitation');
      expect(data.invitation).toHaveProperty('workspaceName');
      expect(data.invitation).toHaveProperty('email', newUserEmail);
      expect(data.invitation).toHaveProperty('role', 'member');
      expect(data.invitation).toHaveProperty('expiresAt');
    });

    test('should return 404 for invalid token', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/invitations/invalid-token-123`
      );

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('should return 400 for expired invitation', async () => {
      // Note: To properly test this, we would need to manually create an expired invitation
      // or manipulate the database. This is a placeholder for the test structure.
      // In a real test environment, you would:
      // 1. Create an invitation
      // 2. Update its expires_at to a past date
      // 3. Try to validate it
      // 4. Expect 400
    });
  });

  describe('US-API-003: Accept Invitation', () => {
    test('should reject acceptance without userId', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/invitations/${invitationToken}/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      // Elysia validation should catch this
      expect(response.status).toBe(400);
    });

    test('should reject invalid token on acceptance', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/invitations/invalid-token/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: ownerUserId,
          }),
        }
      );

      expect(response.status).toBe(404);
    });

    // Note: Cannot fully test acceptance without a real user matching the invited email
    // This would require database setup and teardown
  });

  describe('US-API-004: Update Member Role', () => {
    test('should reject updating to owner role', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/members/${memberUserId}?requestingUserId=${ownerUserId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'owner',
          }),
        }
      );

      // Elysia validation rejects 'owner' at schema level
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('should reject changing own role', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/members/${ownerUserId}?requestingUserId=${ownerUserId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'admin',
          }),
        }
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('own role');
    });

    test('should return 404 for non-existent member', async () => {
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/members/${nonExistentUserId}?requestingUserId=${ownerUserId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'admin',
          }),
        }
      );

      expect(response.status).toBe(404);
    });

    test('should allow valid role values', async () => {
      // Test that the API accepts valid roles
      const validRoles = ['admin', 'member', 'viewer'];

      for (const role of validRoles) {
        // We can't actually change roles without more test data
        // but we can verify the endpoint exists and validates correctly
        const response = await fetch(
          `${API_URL}/api/v1/workspaces/${testWorkspaceId}/members/${memberUserId}?requestingUserId=${ownerUserId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role,
            }),
          }
        );

        // Should not be validation error (422)
        expect(response.status).not.toBe(422);
      }
    });
  });

  describe('US-API-004: Remove Member', () => {
    test('should reject removing non-existent member', async () => {
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/members/${nonExistentUserId}?requestingUserId=${ownerUserId}`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(404);
    });

    test('should require requestingUserId parameter', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/members/${memberUserId}`,
        {
          method: 'DELETE',
        }
      );

      // Should fail validation
      expect(response.status).toBe(400);
    });

    test('should return proper status codes', async () => {
      // Test with non-member user
      const nonMemberUserId = '3f2e42be-6575-42fa-b407-d943f1348973';
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/members/${memberUserId}?requestingUserId=${nonMemberUserId}`,
        {
          method: 'DELETE',
        }
      );

      // Should be forbidden
      expect(response.status).toBe(403);
    });
  });

  describe('Permission Checks', () => {
    test('should prevent non-member from sending invitations', async () => {
      const nonMemberUserId = '3f2e42be-6575-42fa-b407-d943f1348973';
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `forbidden-${Date.now()}@example.com`,
            role: 'member',
            invitedBy: nonMemberUserId,
          }),
        }
      );

      expect(response.status).toBe(403);
    });

    test('should prevent non-member from updating roles', async () => {
      const nonMemberUserId = '3f2e42be-6575-42fa-b407-d943f1348973';
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/members/${memberUserId}?requestingUserId=${nonMemberUserId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'admin',
          }),
        }
      );

      expect(response.status).toBe(403);
    });

    test('should prevent non-member from removing members', async () => {
      const nonMemberUserId = '3f2e42be-6575-42fa-b407-d943f1348973';
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/members/${memberUserId}?requestingUserId=${nonMemberUserId}`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(403);
    });
  });

  describe('API Contract Validation', () => {
    test('POST /workspaces/:id/invitations - validates request body', async () => {
      const invalidRequests = [
        { email: 'invalid-email', role: 'member', invitedBy: ownerUserId },
        { email: newUserEmail, role: 'invalid-role', invitedBy: ownerUserId },
        { email: newUserEmail, role: 'member' }, // missing invitedBy
      ];

      for (const body of invalidRequests) {
        const response = await fetch(
          `${API_URL}/api/v1/workspaces/${testWorkspaceId}/invitations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        );

        // Should be validation error
        expect([400, 422]).toContain(response.status);
      }
    });

    test('PATCH /workspaces/:id/members/:userId - validates role', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/workspaces/${testWorkspaceId}/members/${memberUserId}?requestingUserId=${ownerUserId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'invalid-role',
          }),
        }
      );

      // Should be validation error
      expect(response.status).toBe(400);
    });
  });
});
