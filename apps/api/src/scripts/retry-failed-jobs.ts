#!/usr/bin/env bun
import { db } from '@agios/db/client';

async function main() {
  console.log('Checking for failed generate-todo-title jobs...\n');

  // Query pg-boss job table for failed jobs
  const failedJobs = await db.execute(`
    SELECT
      id,
      name,
      state,
      data,
      retry_count,
      output,
      started_on,
      completed_on
    FROM pgboss.job
    WHERE name = 'generate-todo-title'
      AND state = 'failed'
    ORDER BY created_on DESC
    LIMIT 10
  `);

  console.log(`Found ${failedJobs.rows.length} failed jobs\n`);

  for (const job of failedJobs.rows) {
    console.log(`Job ID: ${job.id}`);
    console.log(`State: ${job.state}`);
    console.log(`Retry count: ${job.retry_count}`);
    console.log(`Output: ${JSON.stringify(job.output, null, 2)}`);
    console.log('---');
  }

  if (failedJobs.rows.length > 0) {
    console.log('\nRetrying failed jobs...');

    // Update state to 'created' to retry
    const retryResult = await db.execute(`
      UPDATE pgboss.job
      SET state = 'created',
          retry_count = 0,
          output = null,
          started_on = null,
          completed_on = null
      WHERE name = 'generate-todo-title'
        AND state = 'failed'
      RETURNING id
    `);

    console.log(`✅ Queued ${retryResult.rows.length} jobs for retry`);
  }

  process.exit(0);
}

main().catch(console.error);