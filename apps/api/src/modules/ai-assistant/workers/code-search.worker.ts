/**
 * Code Search Worker
 * Backend worker that listens for code search requests and delegates to CLI via HTTP
 */

import { Pool, type PoolClient } from 'pg';
import chalk from 'chalk';

export interface CodeSearchJob {
  searchId: string;
  workspaceId: string;
  query: string;
  caseSensitive?: boolean;
  filePattern?: string;
  contextLines?: number;
  maxResults?: number;
  requestedBy: string;
}

export interface CodeSearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface CodeSearchEvent {
  type: 'progress' | 'result' | 'results_batch' | 'complete' | 'error';
  searchId?: string;
  data?: CodeSearchResult | CodeSearchResult[];
  filesScanned?: number;
  totalMatches?: number;
  executionTimeMs?: number;
  truncated?: boolean;
  error?: string;
  message?: string;
  timestamp: string;
}

let isRunning = false;
let dbPool: Pool | null = null;
let dbClient: PoolClient | null = null;

// CLI HTTP endpoint (configurable via env)
const CLI_HTTP_URL = process.env.CLI_HTTP_URL || 'http://localhost:3002';

/**
 * Start the code search worker
 */
export async function startCodeSearchWorker(verbose = false): Promise<void> {
  if (isRunning) {
    if (verbose) console.log(chalk.yellow('⚠️  Code search worker already running'));
    return;
  }

  // Get DATABASE_URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set in environment');
  }

  // Create PostgreSQL connection pool
  dbPool = new Pool({
    connectionString: databaseUrl,
    max: 2,
  });

  // Get a dedicated client for LISTEN
  dbClient = await dbPool.connect();

  isRunning = true;
  console.log(chalk.green('🔍 Code search worker started (backend)'));
  console.log(chalk.dim(`   Listening: PostgreSQL NOTIFY 'code_search_requested'`));
  console.log(chalk.dim(`   CLI HTTP: ${CLI_HTTP_URL}\n`));

  // Listen for code search job notifications
  await dbClient.query('LISTEN code_search_requested');

  // Handle notifications
  dbClient.on('notification', async (msg) => {
    if (msg.channel === 'code_search_requested' && msg.payload) {
      try {
        const job: CodeSearchJob = JSON.parse(msg.payload);

        if (verbose) {
          console.log(chalk.cyan(`📥 Received job: ${job.searchId}`));
          console.log(chalk.dim(`   Workspace: ${job.workspaceId}`));
          console.log(chalk.dim(`   Query: "${job.query}"`));
        }

        // Process the job
        await processCodeSearchJob(job, verbose);
      } catch (error: any) {
        console.error(chalk.red('❌ Error parsing job notification:'), error.message);
      }
    }
  });

  // Handle connection errors
  dbClient.on('error', (error) => {
    console.error(chalk.red('❌ PostgreSQL connection error:'), error);
    // Attempt reconnection
    if (isRunning) {
      console.log(chalk.yellow('🔄 Attempting to reconnect...'));
      stopCodeSearchWorker();
      setTimeout(() => {
        startCodeSearchWorker(verbose).catch(console.error);
      }, 5000);
    }
  });
}

/**
 * Stop the code search worker
 */
export function stopCodeSearchWorker(): void {
  if (!isRunning) {
    return;
  }

  isRunning = false;

  // Unlisten and release client
  if (dbClient) {
    dbClient.query('UNLISTEN code_search_requested').catch(console.error);
    dbClient.release();
    dbClient = null;
  }

  // Close pool
  if (dbPool) {
    dbPool.end().catch(console.error);
    dbPool = null;
  }

  console.log(chalk.yellow('🛑 Code search worker stopped'));
}

/**
 * Process a code search job by calling CLI HTTP endpoint
 */
async function processCodeSearchJob(
  job: CodeSearchJob,
  verbose = false
): Promise<void> {
  const startTime = Date.now();

  if (verbose) {
    console.log(chalk.blue(`🔎 Calling CLI to execute search`));
  }

  try {
    // Call CLI HTTP endpoint
    const response = await fetch(`${CLI_HTTP_URL}/api/execute-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: job.query,
        filePattern: job.filePattern,
        caseSensitive: job.caseSensitive,
        contextLines: job.contextLines,
        maxResults: job.maxResults,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.log(chalk.red(`❌ CLI search failed: ${errorData.error || errorData.message}`));

      await publishSearchEvent(
        job.searchId,
        {
          type: 'error',
          error: errorData.error || 'CLI_REQUEST_FAILED',
          message: errorData.message || 'Failed to execute search on CLI',
          timestamp: new Date().toISOString(),
        },
        verbose
      );

      return;
    }

    // Parse CLI response
    const result = await response.json();

    // Publish results in batches
    const BATCH_SIZE = 10;
    const batches: CodeSearchResult[][] = [];
    for (let i = 0; i < result.results.length; i += BATCH_SIZE) {
      batches.push(result.results.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      await publishSearchEvent(
        job.searchId,
        {
          type: 'results_batch',
          data: batch,
          timestamp: new Date().toISOString(),
        },
        verbose
      );

      if (verbose) {
        console.log(chalk.gray(`   📤 Published batch of ${batch.length} results`));
      }
    }

    // Publish completion event
    await publishSearchEvent(
      job.searchId,
      {
        type: 'complete',
        totalMatches: result.totalMatches,
        executionTimeMs: result.executionTimeMs,
        truncated: result.truncated,
        timestamp: new Date().toISOString(),
      },
      verbose
    );

    if (verbose) {
      console.log(chalk.green(`✅ Found ${result.totalMatches} matches in ${result.executionTimeMs}ms`));
      if (result.truncated) {
        console.log(chalk.yellow(`⚠️  Results truncated (max: ${job.maxResults || 500})`));
      }
    }
  } catch (error: any) {
    console.error(chalk.red(`❌ Error processing search job: ${error.message}`));

    await publishSearchEvent(
      job.searchId,
      {
        type: 'error',
        error: 'INTERNAL_ERROR',
        message: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      verbose
    );
  }
}

/**
 * Publish search event via PostgreSQL NOTIFY
 * Channel format: code_search_{searchId}
 */
async function publishSearchEvent(
  searchId: string,
  event: CodeSearchEvent,
  verbose = false
): Promise<void> {
  if (!dbPool) {
    console.error(chalk.red('❌ Database pool not initialized'));
    return;
  }

  // Get a client from the pool for this NOTIFY
  const client = await dbPool.connect();

  try {
    const channel = `code_search_${searchId}`;
    const payload = JSON.stringify(event);

    // NOTIFY doesn't support parameterized queries, must use string concatenation
    // Escape single quotes in payload
    const escapedPayload = payload.replace(/'/g, "''");
    // Channel names with hyphens must be double-quoted
    await client.query(`NOTIFY "${channel}", '${escapedPayload}'`);
  } catch (error: any) {
    console.error(chalk.red(`❌ Failed to publish event: ${error.message}`));
  } finally {
    // Always release the client back to the pool
    client.release();
  }
}

/**
 * Check if worker is running
 */
export function isCodeSearchWorkerRunning(): boolean {
  return isRunning;
}
