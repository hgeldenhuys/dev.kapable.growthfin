/**
 * Performance Monitoring Middleware
 * US-CONF-009 AC-006: Performance monitoring alerts configured
 *
 * Tracks request duration and logs slow requests
 */

import type { Context } from 'elysia';

export interface PerformanceMetrics {
  route: string;
  method: string;
  duration: number;
  timestamp: Date;
  status?: number;
}

// In-memory metrics store (could be replaced with Redis/TimescaleDB in production)
const metrics: PerformanceMetrics[] = [];
const MAX_METRICS = 1000;

// Performance thresholds (ms)
const THRESHOLDS = {
  SLOW_REQUEST: 1000, // 1 second
  CRITICAL_REQUEST: 5000, // 5 seconds
  ENRICHMENT_ENDPOINT: 10000, // 10 seconds for enrichment
};

/**
 * Performance monitoring middleware
 */
export async function performanceMonitoring(
  handler: (context: Context) => Promise<any>
) {
  return async (context: Context) => {
    const start = performance.now();
    const route = context.path || 'unknown';
    const method = context.request.method;

    try {
      // Execute request
      const response = await handler(context);

      // Calculate duration
      const duration = performance.now() - start;

      // Record metrics
      recordMetrics({
        route,
        method,
        duration,
        timestamp: new Date(),
        status: 200, // Assume success if no error
      });

      // Log slow requests
      if (duration > getThreshold(route)) {
        logSlowRequest(route, method, duration);
      }

      return response;
    } catch (error) {
      const duration = performance.now() - start;

      // Record failed request
      recordMetrics({
        route,
        method,
        duration,
        timestamp: new Date(),
        status: 500,
      });

      throw error;
    }
  };
}

/**
 * Get performance threshold for specific route
 */
function getThreshold(route: string): number {
  if (route.includes('/enrichment') || route.includes('/enrich')) {
    return THRESHOLDS.ENRICHMENT_ENDPOINT;
  }
  return THRESHOLDS.SLOW_REQUEST;
}

/**
 * Record performance metrics
 */
function recordMetrics(metric: PerformanceMetrics) {
  metrics.push(metric);

  // Keep only recent metrics
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }
}

/**
 * Log slow request with details
 */
function logSlowRequest(route: string, method: string, duration: number) {
  const level = duration > THRESHOLDS.CRITICAL_REQUEST ? 'error' : 'warn';

  console[level]('[Performance] Slow request detected', {
    route,
    method,
    duration: `${duration.toFixed(2)}ms`,
    threshold: `${getThreshold(route)}ms`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get performance statistics
 */
export function getPerformanceStats() {
  if (metrics.length === 0) {
    return {
      total: 0,
      avgDuration: 0,
      slowRequests: 0,
      criticalRequests: 0,
      routes: {},
    };
  }

  const stats = {
    total: metrics.length,
    avgDuration: 0,
    slowRequests: 0,
    criticalRequests: 0,
    routes: {} as Record<string, { count: number; avgDuration: number }>,
  };

  let totalDuration = 0;

  for (const metric of metrics) {
    totalDuration += metric.duration;

    if (metric.duration > THRESHOLDS.SLOW_REQUEST) {
      stats.slowRequests++;
    }
    if (metric.duration > THRESHOLDS.CRITICAL_REQUEST) {
      stats.criticalRequests++;
    }

    // Track per-route stats
    if (!stats.routes[metric.route]) {
      stats.routes[metric.route] = { count: 0, avgDuration: 0 };
    }
    const routeStats = stats.routes[metric.route];
    routeStats.count++;
    routeStats.avgDuration =
      (routeStats.avgDuration * (routeStats.count - 1) + metric.duration) /
      routeStats.count;
  }

  stats.avgDuration = totalDuration / metrics.length;

  return stats;
}

/**
 * Get recent slow requests
 */
export function getSlowRequests(limit = 10) {
  return metrics
    .filter((m) => m.duration > THRESHOLDS.SLOW_REQUEST)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, limit);
}

/**
 * Clear metrics (for testing)
 */
export function clearMetrics() {
  metrics.length = 0;
}

/**
 * Export metrics for external monitoring systems
 */
export function exportMetrics() {
  return {
    metrics: [...metrics],
    stats: getPerformanceStats(),
    thresholds: THRESHOLDS,
    timestamp: new Date().toISOString(),
  };
}
