#!/usr/bin/env bun
import { db } from '@agios/db/client';
import { jobQueue } from '../lib/queue';

async function main() {
  console.log('Starting job queue and retrying failed generate-todo-title jobs...\n');

  try {
    // Initialize the job queue
    await jobQueue.start();
    console.log('Job queue started successfully');

    // Get the PgBoss instance
    const boss = jobQueue.getBoss();

    // Query database directly for failed jobs
    const failedJobs = await db.execute(`
      SELECT id, data, retry_count
      FROM pgboss.job
      WHERE name = 'generate-todo-title'
        AND state = 'failed'
      ORDER BY created_on DESC
      LIMIT 100
    `);

    console.log(`Found ${failedJobs.length} failed jobs to retry\n`);

    if (failedJobs.length > 0) {
      let retriedCount = 0;

      // Show first few jobs
      console.log('Sample of failed jobs:');
      for (let i = 0; i < Math.min(3, failedJobs.length); i++) {
        const job = failedJobs[i];
        console.log(`  - Job ${job.id}: retry count = ${job.retry_count}`);
      }
      console.log('');

      // Retry each job
      for (const job of failedJobs) {
        try {
          // Use the retry method with UUID
          await boss.retry(job.id);
          retriedCount++;
          if (retriedCount % 10 === 0) {
            console.log(`  Retried ${retriedCount} jobs...`);
          }
        } catch (e) {
          // Try alternative: reset job state
          try {
            await db.execute(`
              UPDATE pgboss.job
              SET state = 'created',
                  retry_count = retry_count + 1,
                  started_on = null,
                  completed_on = null,
                  output = null
              WHERE id = $1
            `, [job.id]);
            retriedCount++;
          } catch (e2) {
            console.error(`Failed to retry job ${job.id}: ${e2.message}`);
          }
        }
      }

      console.log(`\n✅ Successfully retried ${retriedCount} jobs`);
    } else {
      console.log('No failed jobs to retry');
    }

    // Check current queue status
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusResult = await db.execute(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'created') as queued,
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'completed') as completed,
        COUNT(*) FILTER (WHERE state = 'failed') as failed
      FROM pgboss.job
      WHERE name = 'generate-todo-title'
    `);

    const status = statusResult[0];
    console.log('\n📊 Current job status:');
    console.log(`  - Queued: ${status.queued}`);
    console.log(`  - Active: ${status.active}`);
    console.log(`  - Completed: ${status.completed}`);
    console.log(`  - Failed: ${status.failed}`);

    // Stop the queue properly
    await jobQueue.stop();
    console.log('\nJob queue stopped');

  } catch (error) {
    console.error('Error:', error.message);
    await jobQueue.stop();
  }

  process.exit(0);
}

main().catch(console.error);