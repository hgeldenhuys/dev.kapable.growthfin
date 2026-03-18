/**
 * Session Metrics Schema
 * US-001: Add session metrics dashboard
 *
 * This file defines types and interfaces for session metrics.
 * Metrics are computed from existing tables (claude_sessions, hook_events)
 * rather than stored in a separate table for real-time accuracy.
 */

import { sql } from 'drizzle-orm';
import { pgView, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

// ============================================================================
// Computed Metrics Types (not stored, computed on query)
// ============================================================================

/**
 * Session metric summary for a single session
 */
export interface SessionMetric {
  sessionId: string;
  sessionName?: string;          // User-friendly name from sessions.json
  projectId: string;
  agentType?: string;            // Current or last agent type
  startedAt: string;             // First event timestamp
  lastActivityAt: string;        // Most recent event timestamp
  durationMs: number;            // Time between first and last event
  eventCount: number;            // Total hook events
  toolUsage: Record<string, number>;  // Tool name -> usage count
  todoStats: {
    completed: number;
    inProgress: number;
    pending: number;
  };
}

/**
 * Aggregated metrics across all sessions
 */
export interface SessionMetricsAggregate {
  totalSessions: number;
  activeSessions: number;        // Sessions with activity in last 30 minutes
  avgDurationMs: number;
  totalDurationMs: number;
  topTools: Array<{ name: string; count: number }>;
  sessionsByAgentType: Record<string, number>;
  recentSessions: SessionMetric[];
}

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
  toolName: string;
  totalUsage: number;
  sessionCount: number;          // How many sessions used this tool
  avgUsagePerSession: number;
}

/**
 * Duration analytics
 */
export interface DurationAnalytics {
  avgDurationMs: number;
  medianDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  totalDurationMs: number;
  p90DurationMs: number;         // 90th percentile
}

// ============================================================================
// Real-time SSE Event Types
// ============================================================================

/**
 * SSE event for session metrics updates
 */
export interface SessionMetricsSSEEvent {
  type: 'metrics_update' | 'session_start' | 'session_end' | 'tool_usage';
  timestamp: string;
  data: Partial<SessionMetricsAggregate> | SessionMetric;
}

// ============================================================================
// Query Parameters
// ============================================================================

/**
 * Parameters for filtering session metrics
 */
export interface SessionMetricsQueryParams {
  projectId?: string;
  agentType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}
