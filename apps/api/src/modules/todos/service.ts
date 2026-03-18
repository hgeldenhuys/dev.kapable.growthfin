/**
 * Todos Service
 * Business logic for persistent todo operations
 */

import type { Database } from '@agios/db';
import { todos, type Todo, type NewTodo, type TodoWithMetadata } from '@agios/db';
import { eq, and, desc, sql, or } from 'drizzle-orm';

export const todoService = {
  /**
   * Get ALL latest todos (for wildcard queries)
   * Returns todos from the most recent TodoWrite call per project/agent
   * @param db - Database instance
   * @param agentId - Optional agent type filter
   */
  async getAllLatest(
    db: Database,
    agentId?: string
  ): Promise<TodoWithMetadata[]> {
    // Get all todos for the specified agent (or all agents if not specified)
    const allTodos = await db
      .select()
      .from(todos)
      .where(agentId ? eq(todos.agentId, agentId) : undefined)
      .orderBy(desc(todos.createdAt));

    if (allTodos.length === 0) {
      return [];
    }

    // Group by project/agent and track the latest timestamp for each combo
    const latestByCombo = new Map<string, Date>();
    
    for (const todo of allTodos) {
      const key = `${todo.projectId}|${todo.agentId}`;
      if (!latestByCombo.has(key)) {
        latestByCombo.set(key, todo.createdAt);
      }
    }

    // Filter todos to only those with the latest timestamp for their project/agent
    const results: TodoWithMetadata[] = [];
    for (const todo of allTodos) {
      const key = `${todo.projectId}|${todo.agentId}`;
      const latestTime = latestByCombo.get(key)!;
      if (todo.createdAt.getTime() === latestTime.getTime()) {
        results.push({
          ...todo,
          fromPreviousSession: !!todo.migratedFrom,
        });
      }
    }

    return results.sort((a, b) => a.order - b.order);
  },

  /**
   * Get all latest todos for a specific project (all agents)
   * Returns todos from the most recent TodoWrite call per agent
   * @param db - Database instance
   * @param projectId - Project ID to filter
   */
  async getAllLatestForProject(
    db: Database,
    projectId: string
  ): Promise<TodoWithMetadata[]> {
    // Get all todos for this project, ordered by created_at descending
    const allTodos = await db
      .select()
      .from(todos)
      .where(eq(todos.projectId, projectId))
      .orderBy(desc(todos.createdAt));

    if (allTodos.length === 0) {
      return [];
    }

    // For each agent in this project, track the max created_at timestamp
    const latestByAgent = new Map<string, Date>();
    
    for (const todo of allTodos) {
      if (!latestByAgent.has(todo.agentId)) {
        latestByAgent.set(todo.agentId, todo.createdAt);
      }
    }

    // Filter todos to only those with the latest timestamp for their agent
    const results: TodoWithMetadata[] = [];
    for (const todo of allTodos) {
      const latestTime = latestByAgent.get(todo.agentId)!;
      if (todo.createdAt.getTime() === latestTime.getTime()) {
        results.push({
          ...todo,
          fromPreviousSession: !!todo.migratedFrom,
        });
      }
    }

    return results.sort((a, b) => a.order - b.order);
  },

  /**
   * Get latest todos for a project+agent
   * Returns todos from the MOST RECENT TodoWrite call (latest created_at timestamp)
   * @param db - Database instance
   * @param projectId - Project ID to filter
   * @param agentId - Agent type identifier (e.g., 'main', 'backend-dev')
   * @param includeHistorical - Include todos from previous sessions
   * @param sessionId - Optionally filter by specific session
   */
  async getLatest(
    db: Database,
    projectId: string,
    agentId: string,
    includeHistorical = false,
    sessionId?: string
  ): Promise<TodoWithMetadata[]> {
    // If sessionId is provided, get todos ONLY from that session
    // Otherwise, find the most recent session and get its todos
    let targetSessionId = sessionId;

    if (!targetSessionId) {
      // Find the most recent session for this project/agent
      const latestTodo = await db
        .select()
        .from(todos)
        .where(and(
          eq(todos.projectId, projectId),
          eq(todos.agentId, agentId)
        ))
        .orderBy(desc(todos.createdAt))
        .limit(1);

      if (latestTodo.length === 0) {
        return [];
      }

      targetSessionId = latestTodo[0].sessionId;
    }

    // Get all todos from the target session
    const sessionTodos = await db
      .select()
      .from(todos)
      .where(and(
        eq(todos.projectId, projectId),
        eq(todos.agentId, agentId),
        eq(todos.sessionId, targetSessionId)
      ))
      .orderBy(desc(todos.createdAt), todos.order);

    if (sessionTodos.length === 0) {
      return [];
    }

    // Get the most recent created_at timestamp within this session
    const latestTimestamp = sessionTodos[0].createdAt;

    // Filter to only todos from that exact timestamp (the complete TodoWrite set)
    const latestSet = sessionTodos.filter(todo =>
      todo.createdAt.getTime() === latestTimestamp.getTime()
    );

    return latestSet.map((todo) => ({
      ...todo,
      fromPreviousSession: !!todo.migratedFrom,
    }));
  },

  /**
   * Get todos grouped by session
   * Useful for showing session history
   */
  async getBySession(
    db: Database,
    projectId?: string,
    agentId?: string,
    includeHistorical?: boolean
  ): Promise<
    Array<{
      sessionId: string;
      projectId: string;
      todos: TodoWithMetadata[];
      isLatest: boolean;
      firstCreated: Date;
      lastUpdated: Date;
    }>
  > {
    const conditions = [];

    if (projectId) {
      conditions.push(eq(todos.projectId, projectId));
    }

    if (agentId) {
      conditions.push(eq(todos.agentId, agentId));
    }

    if (includeHistorical !== false) {
      // If not explicitly false, include all
      // Don't filter by isLatest
    } else {
      conditions.push(eq(todos.isLatest, true));
    }

    const results = await db
      .select()
      .from(todos)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(todos.createdAt));

    // Group by session
    const sessionMap = new Map<string, TodoWithMetadata[]>();

    for (const todo of results) {
      if (!sessionMap.has(todo.sessionId)) {
        sessionMap.set(todo.sessionId, []);
      }
      sessionMap.get(todo.sessionId)!.push({
        ...todo,
        fromPreviousSession: !!todo.migratedFrom,
      });
    }

    // Convert to array with session metadata
    return Array.from(sessionMap.entries()).map(([sessionId, sessionTodos]) => ({
      sessionId,
      projectId: sessionTodos[0]?.projectId || '',
      todos: sessionTodos.sort((a, b) => a.order - b.order),
      isLatest: sessionTodos.some((t) => t.isLatest),
      firstCreated: new Date(Math.min(...sessionTodos.map(t => new Date(t.createdAt).getTime()))),
      lastUpdated: new Date(Math.max(...sessionTodos.map(t => new Date(t.updatedAt).getTime()))),
    }));
  },

  /**
   * Create a new todo
   */
  async create(db: Database, todo: NewTodo): Promise<Todo> {
    const result = await db
      .insert(todos)
      .values({
        ...todo,
        isLatest: true,
      })
      .returning();

    return result[0];
  },

  /**
   * Update an existing todo
   */
  async update(db: Database, id: string, updates: Partial<NewTodo>): Promise<Todo | null> {
    const result = await db
      .update(todos)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(todos.id, id))
      .returning();

    return result[0] || null;
  },

  /**
   * Delete a todo
   */
  async delete(db: Database, id: string): Promise<boolean> {
    const result = await db.delete(todos).where(eq(todos.id, id)).returning();

    return result.length > 0;
  },

  /**
   * Start a new session - DISABLED: Do not migrate todos from previous session
   * New sessions start with a clean slate
   */
  async startSession(
    db: Database,
    newSessionId: string,
    projectId: string,
    agentId: string,
    previousSessionId?: string
  ): Promise<Todo[]> {
    console.log('[todoService] Starting new session - no migration (DISABLED)');
    return [];
  },

  /**
   * Get session history for a project+agent
   * Returns list of sessions with todo counts
   */
  async getSessionHistory(
    db: Database,
    projectId: string,
    agentId: string
  ): Promise<
    Array<{
      sessionId: string;
      todoCount: number;
      isLatest: boolean;
      latestUpdate: Date;
    }>
  > {
    const results = await db
      .select({
        sessionId: todos.sessionId,
        todoCount: sql<number>`count(*)::int`,
        isLatest: sql<boolean>`bool_or(${todos.isLatest})`,
        latestUpdate: sql<Date>`max(${todos.updatedAt})`,
      })
      .from(todos)
      .where(and(eq(todos.projectId, projectId), eq(todos.agentId, agentId)))
      .groupBy(todos.sessionId)
      .orderBy(sql`max(${todos.updatedAt}) DESC`);

    return results;
  },
};
