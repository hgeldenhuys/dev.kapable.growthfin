#!/usr/bin/env bun
import { jobQueue } from '../lib/queue';

async function main() {
  console.log('Starting job queue and retrying failed generate-todo-title jobs...\n');

  try {
    // Initialize the job queue
    await jobQueue.start();
    console.log('Job queue started successfully');

    // Get the PgBoss instance
    const boss = jobQueue.getBoss();

    // Get failed jobs
    const failedJobs = await boss.getFailed('generate-todo-title', { size: 1000 });
    console.log(`Found ${failedJobs.length} failed jobs to retry`);

    if (failedJobs.length > 0) {
      // Retry each failed job
      let retriedCount = 0;
      for (const job of failedJobs) {
        try {
          await boss.retry(job.id);
          retriedCount++;
        } catch (e) {
          console.error(`Failed to retry job ${job.id}: ${e.message}`);
        }
      }

      console.log(`\n✅ Successfully retried ${retriedCount} jobs`);
    } else {
      console.log('No failed jobs to retry');
    }

    // Check current queue status
    await new Promise(resolve => setTimeout(resolve, 2000));

    const queueSize = await boss.getQueueSize('generate-todo-title');
    const completedCount = await boss.getCompletedCount('generate-todo-title');
    const failedCount = await boss.getFailedCount('generate-todo-title');

    console.log('\n📊 Current job status:');
    console.log(`  - Queued: ${queueSize}`);
    console.log(`  - Completed: ${completedCount}`);
    console.log(`  - Failed: ${failedCount}`);

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