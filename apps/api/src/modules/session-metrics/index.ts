/**
 * Session Metrics Module
 * US-001: Add session metrics dashboard
 *
 * Provides session metrics API:
 * - GET /session-metrics/sessions - List sessions with metrics
 * - GET /session-metrics/aggregate - Aggregated metrics summary
 * - GET /session-metrics/tools - Tool usage statistics
 * - GET /session-metrics/duration - Duration analytics
 * - GET /session-metrics/stream - SSE streaming for real-time updates
 */

import { Elysia } from 'elysia';
import { sessionMetricsRoutes } from './routes';

export const sessionMetricsModule = new Elysia({ prefix: '/session-metrics' })
  .use(sessionMetricsRoutes);
