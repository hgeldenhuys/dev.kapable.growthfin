/**
 * Unit Tests for Audit Service
 * Tests the audit logging functions in isolation
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { config } from 'dotenv';
import { logAuditEvent, AuditActions, ResourceTypes } from '../audit';

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required for tests');
}

describe('Audit Service Unit Tests', () => {
  let db: any;
  let sql: any;
  let testWorkspaceId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Set up database connection
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;

    sql = postgres(DATABASE_URL);
    db = drizzle(sql);

    // Use existing test data
    testWorkspaceId = '9d753529-cc68-4a23-9063-68ac0e952403';
    testUserId = 'bea5f24c-d154-466b-8920-a73596f1f7ab';
  });

  afterAll(async () => {
    if (sql) {
      await sql.end();
    }
  });

  test('should log audit event with all required fields', async () => {
    await logAuditEvent(db, {
      workspaceId: testWorkspaceId,
      userId: testUserId,
      action: AuditActions.INVITED_MEMBER,
      resourceType: ResourceTypes.WORKSPACE_MEMBER,
      changes: {
        after: { email: 'test@example.com', role: 'member' },
      },
    });

    // Verify by querying
    const { workspaceAuditLog } = await import('@agios/db');
    const { eq, and, desc } = await import('drizzle-orm');

    const logs = await db
      .select()
      .from(workspaceAuditLog)
      .where(
        and(
          eq(workspaceAuditLog.workspaceId, testWorkspaceId),
          eq(workspaceAuditLog.userId, testUserId),
          eq(workspaceAuditLog.action, AuditActions.INVITED_MEMBER)
        )
      )
      .orderBy(desc(workspaceAuditLog.createdAt))
      .limit(1);

    expect(logs.length).toBeGreaterThan(0);
    const log = logs[0];

    expect(log.workspaceId).toBe(testWorkspaceId);
    expect(log.userId).toBe(testUserId);
    expect(log.action).toBe(AuditActions.INVITED_MEMBER);
    expect(log.resourceType).toBe(ResourceTypes.WORKSPACE_MEMBER);
    expect(log.changes).toBeTruthy();
  });

  test('should log audit event with before/after changes', async () => {
    await logAuditEvent(db, {
      workspaceId: testWorkspaceId,
      userId: testUserId,
      action: AuditActions.CHANGED_ROLE,
      resourceType: ResourceTypes.WORKSPACE_MEMBER,
      resourceId: testUserId,
      changes: {
        before: { role: 'member' },
        after: { role: 'admin' },
      },
    });

    const { workspaceAuditLog } = await import('@agios/db');
    const { eq, and, desc } = await import('drizzle-orm');

    const logs = await db
      .select()
      .from(workspaceAuditLog)
      .where(
        and(
          eq(workspaceAuditLog.workspaceId, testWorkspaceId),
          eq(workspaceAuditLog.action, AuditActions.CHANGED_ROLE)
        )
      )
      .orderBy(desc(workspaceAuditLog.createdAt))
      .limit(1);

    expect(logs.length).toBeGreaterThan(0);
    const log = logs[0];

    const changes = log.changes as any;
    expect(changes.before).toBeTruthy();
    expect(changes.before.role).toBe('member');
    expect(changes.after).toBeTruthy();
    expect(changes.after.role).toBe('admin');
  });

  test('should handle audit logging errors gracefully', async () => {
    // Try to log with invalid workspace ID - should not throw
    await expect(
      logAuditEvent(db, {
        workspaceId: '00000000-0000-0000-0000-000000000000',
        userId: testUserId,
        action: AuditActions.INVITED_MEMBER,
        resourceType: ResourceTypes.WORKSPACE_MEMBER,
      })
    ).resolves.toBeUndefined();

    // Should log error to console but not throw
    console.log('[Test] Audit error handling verified');
  });

  test('should support all action types', () => {
    // Verify all action constants are defined
    expect(AuditActions.INVITED_MEMBER).toBe('invited_member');
    expect(AuditActions.ACCEPTED_INVITATION).toBe('accepted_invitation');
    expect(AuditActions.CHANGED_ROLE).toBe('changed_role');
    expect(AuditActions.REMOVED_MEMBER).toBe('removed_member');
    expect(AuditActions.CREATED).toBe('created');
    expect(AuditActions.UPDATED).toBe('updated');
    expect(AuditActions.DELETED).toBe('deleted');
    expect(AuditActions.RESTORED).toBe('restored');
  });

  test('should support all resource types', () => {
    // Verify all resource type constants are defined
    expect(ResourceTypes.WORKSPACE_MEMBER).toBe('workspace_member');
    expect(ResourceTypes.WORKSPACE_SETTINGS).toBe('workspace_settings');
    expect(ResourceTypes.CAMPAIGN).toBe('campaign');
    expect(ResourceTypes.CONTACT).toBe('contact');
    expect(ResourceTypes.ACCOUNT).toBe('account');
    expect(ResourceTypes.LEAD).toBe('lead');
    expect(ResourceTypes.OPPORTUNITY).toBe('opportunity');
  });

  test('should create timestamped audit logs', async () => {
    const beforeTime = new Date();

    await logAuditEvent(db, {
      workspaceId: testWorkspaceId,
      userId: testUserId,
      action: AuditActions.INVITED_MEMBER,
      resourceType: ResourceTypes.WORKSPACE_MEMBER,
    });

    const afterTime = new Date();

    const { workspaceAuditLog } = await import('@agios/db');
    const { eq, and, desc } = await import('drizzle-orm');

    const logs = await db
      .select()
      .from(workspaceAuditLog)
      .where(
        and(
          eq(workspaceAuditLog.workspaceId, testWorkspaceId),
          eq(workspaceAuditLog.userId, testUserId)
        )
      )
      .orderBy(desc(workspaceAuditLog.createdAt))
      .limit(1);

    expect(logs.length).toBeGreaterThan(0);
    const log = logs[0];

    const createdAt = new Date(log.createdAt);
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000);
    expect(createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
  });
});
