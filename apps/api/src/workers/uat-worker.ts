/**
 * UAT Worker
 *
 * Background process that runs the Connect app UAT script periodically
 * to catch regressions early. Follows the same pattern as webhook-worker.
 *
 * - Runs every 6 hours
 * - Spawns `bun run scripts/uat-connect-app.ts` as a subprocess
 * - Logs pass/fail results (journalctl captures)
 * - Graceful shutdown on stop
 */

import { join } from 'path';

const UAT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const UAT_SCRIPT_PATH = join(import.meta.dir, '../../scripts/uat-connect-app.ts');
const BUN_PATH = '/home/deploy/.bun/bin/bun'; // Full path needed when spawning from systemd

let isRunning = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastRun: Date | null = null;
let lastResult: 'pass' | 'fail' | 'error' | null = null;
let lastOutput: string | null = null;

/**
 * Start the UAT worker
 */
export function startUatWorker(): void {
  if (isRunning) {
    console.log('[uat-worker] Already running');
    return;
  }

  isRunning = true;
  console.log('[uat-worker] Starting — UAT runs every 6 hours');

  // Run first UAT after a 30-second delay (let server fully start)
  timer = setTimeout(runUat, 30_000);

  console.log('[uat-worker] Started successfully');
}

/**
 * Stop the UAT worker
 */
export function stopUatWorker(): void {
  if (!isRunning) {
    console.log('[uat-worker] Not running');
    return;
  }

  isRunning = false;

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  console.log('[uat-worker] Stopped');
}

/**
 * Run the UAT script as a subprocess
 */
async function runUat(): Promise<void> {
  if (!isRunning) return;

  console.log('[uat-worker] Running UAT...');
  lastRun = new Date();

  try {
    const proc = Bun.spawn([BUN_PATH, 'run', UAT_SCRIPT_PATH], {
      cwd: join(import.meta.dir, '../..'),
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        // Ensure the script connects to the local API
        API_URL: process.env.API_URL || 'http://127.0.0.1:3003',
      },
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    const output = (stdout + '\n' + stderr).trim();
    lastOutput = output.slice(-2000); // Keep last 2KB

    if (exitCode === 0) {
      lastResult = 'pass';
      console.log('[uat-worker] UAT PASSED');
    } else {
      lastResult = 'fail';
      console.error(`[uat-worker] UAT FAILED (exit code ${exitCode})`);
      console.error('[uat-worker] Output:', lastOutput);
    }
  } catch (err) {
    lastResult = 'error';
    lastOutput = err instanceof Error ? err.message : String(err);
    console.error('[uat-worker] UAT ERROR:', lastOutput);
  }

  // Schedule next run
  if (isRunning) {
    timer = setTimeout(runUat, UAT_INTERVAL_MS);
    const nextRun = new Date(Date.now() + UAT_INTERVAL_MS);
    console.log(`[uat-worker] Next UAT run at ${nextRun.toISOString()}`);
  }
}

/**
 * Get worker status
 */
export function getUatWorkerStatus(): {
  running: boolean;
  lastRun: string | null;
  lastResult: string | null;
  lastOutput: string | null;
  nextRun: string | null;
} {
  let nextRun: string | null = null;
  if (isRunning && lastRun) {
    nextRun = new Date(lastRun.getTime() + UAT_INTERVAL_MS).toISOString();
  } else if (isRunning) {
    // First run pending (30s after start)
    nextRun = 'pending (initial delay)';
  }

  return {
    running: isRunning,
    lastRun: lastRun?.toISOString() || null,
    lastResult,
    lastOutput,
    nextRun,
  };
}

// Auto-start if this file is run directly
if (import.meta.main) {
  console.log('[uat-worker] Starting as standalone process...');
  startUatWorker();

  process.on('SIGINT', () => {
    console.log('[uat-worker] Received SIGINT, shutting down...');
    stopUatWorker();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[uat-worker] Received SIGTERM, shutting down...');
    stopUatWorker();
    process.exit(0);
  });
}
