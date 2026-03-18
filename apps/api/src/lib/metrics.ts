/**
 * Prometheus-compatible metrics collection
 *
 * Tracks operational metrics for monitoring:
 * - Request latency histograms
 * - Error rates by status code
 * - Active connections
 */

// Histogram buckets for latency (in ms)
const LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

interface HistogramData {
  buckets: Map<number, number>;  // bucket -> count
  sum: number;
  count: number;
}

interface CounterData {
  value: number;
  labels: Map<string, number>;  // label combo -> count
}

// Metrics storage
const histograms = new Map<string, HistogramData>();
const counters = new Map<string, CounterData>();
const gauges = new Map<string, number>();

/**
 * Initialize a histogram
 */
function getOrCreateHistogram(name: string): HistogramData {
  let histogram = histograms.get(name);
  if (!histogram) {
    histogram = {
      buckets: new Map(LATENCY_BUCKETS.map(b => [b, 0])),
      sum: 0,
      count: 0,
    };
    histograms.set(name, histogram);
  }
  return histogram;
}

/**
 * Record a value in a histogram
 */
export function recordHistogram(name: string, value: number): void {
  const histogram = getOrCreateHistogram(name);
  histogram.sum += value;
  histogram.count++;

  // Increment appropriate buckets
  for (const bucket of LATENCY_BUCKETS) {
    if (value <= bucket) {
      histogram.buckets.set(bucket, (histogram.buckets.get(bucket) || 0) + 1);
    }
  }
}

/**
 * Increment a counter
 */
export function incrementCounter(name: string, labels?: Record<string, string>): void {
  let counter = counters.get(name);
  if (!counter) {
    counter = { value: 0, labels: new Map() };
    counters.set(name, counter);
  }

  counter.value++;

  if (labels) {
    const labelKey = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    counter.labels.set(labelKey, (counter.labels.get(labelKey) || 0) + 1);
  }
}

/**
 * Set a gauge value
 */
export function setGauge(name: string, value: number): void {
  gauges.set(name, value);
}

/**
 * Increment a gauge
 */
export function incrementGauge(name: string, delta: number = 1): void {
  gauges.set(name, (gauges.get(name) || 0) + delta);
}

/**
 * Decrement a gauge
 */
export function decrementGauge(name: string, delta: number = 1): void {
  gauges.set(name, Math.max(0, (gauges.get(name) || 0) - delta));
}

/**
 * Track request timing
 */
export function trackRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number
): void {
  // Record latency
  recordHistogram('http_request_duration_ms', durationMs);

  // Increment request counter with labels
  incrementCounter('http_requests_total', {
    method,
    path: normalizePath(path),
    status: String(status),
  });

  // Track errors specifically
  if (status >= 400) {
    incrementCounter('http_errors_total', {
      method,
      path: normalizePath(path),
      status: String(status),
    });
  }
}

/**
 * Normalize path for metrics (remove IDs)
 */
function normalizePath(path: string): string {
  // Replace UUIDs with :id
  return path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );
}

/**
 * Format metrics in Prometheus exposition format
 */
export function formatPrometheusMetrics(): string {
  const lines: string[] = [];

  // Histograms
  for (const [name, data] of histograms) {
    lines.push(`# HELP ${name} Request duration histogram`);
    lines.push(`# TYPE ${name} histogram`);

    for (const [bucket, count] of data.buckets) {
      lines.push(`${name}_bucket{le="${bucket}"} ${count}`);
    }
    lines.push(`${name}_bucket{le="+Inf"} ${data.count}`);
    lines.push(`${name}_sum ${data.sum}`);
    lines.push(`${name}_count ${data.count}`);
  }

  // Counters
  for (const [name, data] of counters) {
    lines.push(`# HELP ${name} Counter`);
    lines.push(`# TYPE ${name} counter`);

    if (data.labels.size > 0) {
      for (const [labels, count] of data.labels) {
        lines.push(`${name}{${labels}} ${count}`);
      }
    } else {
      lines.push(`${name} ${data.value}`);
    }
  }

  // Gauges
  for (const [name, value] of gauges) {
    lines.push(`# HELP ${name} Gauge`);
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name} ${value}`);
  }

  return lines.join('\n');
}

/**
 * Get metrics as JSON (for internal stats)
 */
export function getMetricsJson(): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Histograms summary
  const histogramSummary: Record<string, { avg: number; count: number; p99: number }> = {};
  for (const [name, data] of histograms) {
    const avg = data.count > 0 ? data.sum / data.count : 0;
    // Approximate p99 from buckets
    const p99Bucket = LATENCY_BUCKETS.find(b => {
      const count = data.buckets.get(b) || 0;
      return count >= data.count * 0.99;
    }) || LATENCY_BUCKETS[LATENCY_BUCKETS.length - 1];

    histogramSummary[name] = {
      avg: Math.round(avg * 100) / 100,
      count: data.count,
      p99: p99Bucket,
    };
  }
  result.latency = histogramSummary;

  // Counters
  const counterSummary: Record<string, number | Record<string, number>> = {};
  for (const [name, data] of counters) {
    if (data.labels.size > 0) {
      counterSummary[name] = Object.fromEntries(data.labels);
    } else {
      counterSummary[name] = data.value;
    }
  }
  result.counters = counterSummary;

  // Gauges
  result.gauges = Object.fromEntries(gauges);

  return result;
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  histograms.clear();
  counters.clear();
  gauges.clear();
}
