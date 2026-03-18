#!/usr/bin/env bun
import { db } from '@agios/db/client';

async function main() {
  const jobId = process.argv[2] || 'dba2c917-3d53-4bb7-8d68-d4834ef522f1';

  console.log(`Checking status of job: ${jobId}\n`);

  const result = await db.execute(`
    SELECT
      id,
      name,
      state,
      retry_count,
      data::text as data,
      output::text as output,
      started_on,
      completed_on,
      created_on
    FROM pgboss.job
    WHERE id::text = '${jobId}'
  `);

  if (result && result.length > 0) {
    const job = result[0];
    console.log('Job found:');
    console.log('  Name:', job.name);
    console.log('  State:', job.state);
    console.log('  Retry count:', job.retry_count);
    console.log('  Created:', job.created_on);
    console.log('  Started:', job.started_on);
    console.log('  Completed:', job.completed_on);

    if (job.data) {
      console.log('  Data:', job.data);
    }

    if (job.output) {
      console.log('  Output:', job.output);
    }
  } else {
    console.log('Job not found');
  }

  // Also check recent failed generate-todo-title jobs
  console.log('\n\nRecent generate-todo-title jobs:');
  const recent = await db.execute(`
    SELECT
      id,
      state,
      retry_count,
      created_on,
      output::text as output
    FROM pgboss.job
    WHERE name = 'generate-todo-title'
    ORDER BY created_on DESC
    LIMIT 5
  `);

  for (const job of recent) {
    console.log(`\n  ${job.id}`);
    console.log(`    State: ${job.state}, Retries: ${job.retry_count}`);
    if (job.output && job.state === 'failed') {
      console.log(`    Error: ${job.output.substring(0, 100)}...`);
    }
  }

  process.exit(0);
}

main().catch(console.error);