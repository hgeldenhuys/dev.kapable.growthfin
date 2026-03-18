import { config } from 'dotenv';
config();

/**
 * Todos Service Tests
 * Comprehensive test coverage for todo persistence operations
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { db } from '@agios/db/client';
import { todos, claudeSessions, projects } from '@agios/db';
import { todoService } from './service';
import { eq, and } from 'drizzle-orm';

// Test data
const TEST_PROJECT_ID = 'test-project-todos';
const TEST_SESSION_ID = 'test-session-1';
const TEST_SESSION_ID_2 = 'test-session-2';
const TEST_AGENT_ID = 'test-agent';

describe('TodoService', () => {
  // Setup: Create test project and session
  beforeAll(async () => {
    // Create test project
    await db
      .insert(projects)
      .values({
        id: TEST_PROJECT_ID,
        name: 'Test Project',
        path: '/test/path',
        workspaceId: 'test-workspace',
      })
      .onConflictDoNothing();

    // Create test session
    await db
      .insert(claudeSessions)
      .values({
        id: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        currentAgentType: TEST_AGENT_ID,
      })
      .onConflictDoNothing();

    await db
      .insert(claudeSessions)
      .values({
        id: TEST_SESSION_ID_2,
        projectId: TEST_PROJECT_ID,
        currentAgentType: TEST_AGENT_ID,
      })
      .onConflictDoNothing();
  });

  // Cleanup after each test
  beforeEach(async () => {
    await db
      .delete(todos)
      .where(
        and(eq(todos.projectId, TEST_PROJECT_ID), eq(todos.agentId, TEST_AGENT_ID))
      );
  });

  // Cleanup after all tests
  afterAll(async () => {
    await db
      .delete(todos)
      .where(
        and(eq(todos.projectId, TEST_PROJECT_ID), eq(todos.agentId, TEST_AGENT_ID))
      );
    await db.delete(claudeSessions).where(eq(claudeSessions.projectId, TEST_PROJECT_ID));
    await db.delete(projects).where(eq(projects.id, TEST_PROJECT_ID));
  });

  describe('create', () => {
    test('should create a new todo with isLatest=true', async () => {
      const newTodo = {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Test todo 1',
        activeForm: 'Test form',
        status: 'pending' as const,
        order: 0,
      };

      const created = await todoService.create(db, newTodo);

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.content).toBe('Test todo 1');
      expect(created.isLatest).toBe(true);
      expect(created.projectId).toBe(TEST_PROJECT_ID);
      expect(created.agentId).toBe(TEST_AGENT_ID);
    });
  });

  describe('getLatest', () => {
    test('should return only latest todos by default', async () => {
      // Create some todos
      await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Latest todo 1',
        activeForm: 'Form 1',
        status: 'pending',
        order: 0,
      });

      // Create a historical todo
      await db.insert(todos).values({
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Historical todo',
        activeForm: 'Form 2',
        status: 'pending',
        order: 0,
        isLatest: false,
      });

      const latestTodos = await todoService.getLatest(
        db,
        TEST_PROJECT_ID,
        TEST_AGENT_ID,
        false
      );

      expect(latestTodos).toHaveLength(1);
      expect(latestTodos[0].content).toBe('Latest todo 1');
      expect(latestTodos[0].isLatest).toBe(true);
    });

    test('should return all todos including historical when includeHistorical=true', async () => {
      // Create latest todo
      await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Latest todo',
        activeForm: 'Form 1',
        status: 'pending',
        order: 0,
      });

      // Create historical todo
      await db.insert(todos).values({
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Historical todo',
        activeForm: 'Form 2',
        status: 'pending',
        order: 0,
        isLatest: false,
      });

      const allTodos = await todoService.getLatest(
        db,
        TEST_PROJECT_ID,
        TEST_AGENT_ID,
        true
      );

      expect(allTodos).toHaveLength(2);
    });

    test('should filter by sessionId if provided', async () => {
      // Create todo in session 1
      await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Session 1 todo',
        activeForm: 'Form 1',
        status: 'pending',
        order: 0,
      });

      // Create todo in session 2
      await todoService.create(db, {
        sessionId: TEST_SESSION_ID_2,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Session 2 todo',
        activeForm: 'Form 2',
        status: 'pending',
        order: 0,
      });

      const session1Todos = await todoService.getLatest(
        db,
        TEST_PROJECT_ID,
        TEST_AGENT_ID,
        false,
        TEST_SESSION_ID
      );

      expect(session1Todos).toHaveLength(1);
      expect(session1Todos[0].content).toBe('Session 1 todo');
      expect(session1Todos[0].sessionId).toBe(TEST_SESSION_ID);
    });
  });

  describe('update', () => {
    test('should update todo content', async () => {
      const created = await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Original content',
        activeForm: 'Form 1',
        status: 'pending',
        order: 0,
      });

      const updated = await todoService.update(db, created.id, {
        content: 'Updated content',
      });

      expect(updated).toBeDefined();
      expect(updated?.content).toBe('Updated content');
      expect(updated?.id).toBe(created.id);
    });

    test('should update todo status', async () => {
      const created = await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Todo to complete',
        activeForm: 'Form 1',
        status: 'pending',
        order: 0,
      });

      const updated = await todoService.update(db, created.id, {
        status: 'completed',
      });

      expect(updated?.status).toBe('completed');
    });

    test('should return null for non-existent todo', async () => {
      const updated = await todoService.update(db, 'non-existent-id', {
        content: 'Updated content',
      });

      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    test('should delete a todo', async () => {
      const created = await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Todo to delete',
        activeForm: 'Form 1',
        status: 'pending',
        order: 0,
      });

      const deleted = await todoService.delete(db, created.id);

      expect(deleted).toBe(true);

      // Verify it's actually deleted
      const todos = await todoService.getLatest(
        db,
        TEST_PROJECT_ID,
        TEST_AGENT_ID,
        true
      );
      expect(todos).toHaveLength(0);
    });

    test('should return false for non-existent todo', async () => {
      const deleted = await todoService.delete(db, 'non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('startSession', () => {
    test('should migrate todos from previous session', async () => {
      // Create todos in session 1
      await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Todo 1',
        activeForm: 'Form 1',
        status: 'pending',
        order: 0,
      });

      await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Todo 2',
        activeForm: 'Form 2',
        status: 'in_progress',
        order: 1,
      });

      // Start new session and migrate
      const migratedTodos = await todoService.startSession(
        db,
        TEST_SESSION_ID_2,
        TEST_PROJECT_ID,
        TEST_AGENT_ID,
        TEST_SESSION_ID
      );

      expect(migratedTodos).toHaveLength(2);
      expect(migratedTodos[0].sessionId).toBe(TEST_SESSION_ID_2);
      expect(migratedTodos[0].isLatest).toBe(true);
      expect(migratedTodos[0].migratedFrom).toBe(TEST_SESSION_ID);

      // Verify old todos are marked as not latest
      const oldTodos = await db
        .select()
        .from(todos)
        .where(eq(todos.sessionId, TEST_SESSION_ID));

      for (const todo of oldTodos) {
        expect(todo.isLatest).toBe(false);
      }
    });

    test('should auto-detect previous session if not specified', async () => {
      // Create todos in session 1
      await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Todo 1',
        activeForm: 'Form 1',
        status: 'pending',
        order: 0,
      });

      // Start new session without specifying previous session
      const migratedTodos = await todoService.startSession(
        db,
        TEST_SESSION_ID_2,
        TEST_PROJECT_ID,
        TEST_AGENT_ID
      );

      expect(migratedTodos.length).toBeGreaterThan(0);
      expect(migratedTodos[0].sessionId).toBe(TEST_SESSION_ID_2);
    });

    test('should return empty array if no previous todos exist', async () => {
      const migratedTodos = await todoService.startSession(
        db,
        TEST_SESSION_ID_2,
        TEST_PROJECT_ID,
        'non-existent-agent',
        TEST_SESSION_ID
      );

      expect(migratedTodos).toHaveLength(0);
    });
  });

  describe('getBySession', () => {
    test('should group todos by session', async () => {
      // Create todos in session 1
      await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Session 1 Todo',
        activeForm: 'Form 1',
        status: 'pending',
        order: 0,
      });

      // Create todos in session 2
      await todoService.create(db, {
        sessionId: TEST_SESSION_ID_2,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Session 2 Todo',
        activeForm: 'Form 2',
        status: 'pending',
        order: 0,
      });

      const sessions = await todoService.getBySession(db, TEST_PROJECT_ID, TEST_AGENT_ID);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].todos.length).toBeGreaterThan(0);
      expect(sessions[1].todos.length).toBeGreaterThan(0);
    });
  });

  describe('getSessionHistory', () => {
    test('should return session history with metadata', async () => {
      // Create todos in session 1
      await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Todo 1',
        activeForm: 'Form 1',
        status: 'pending',
        order: 0,
      });

      await todoService.create(db, {
        sessionId: TEST_SESSION_ID,
        projectId: TEST_PROJECT_ID,
        agentId: TEST_AGENT_ID,
        content: 'Todo 2',
        activeForm: 'Form 2',
        status: 'pending',
        order: 1,
      });

      const history = await todoService.getSessionHistory(
        db,
        TEST_PROJECT_ID,
        TEST_AGENT_ID
      );

      expect(history).toHaveLength(1);
      expect(history[0].sessionId).toBe(TEST_SESSION_ID);
      expect(history[0].todoCount).toBe(2);
      expect(history[0].isLatest).toBe(true);
      expect(history[0].latestUpdate).toBeDefined();
    });
  });
});
