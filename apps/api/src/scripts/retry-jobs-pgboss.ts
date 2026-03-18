#!/usr/bin/env bun
import { jobQueue } from '../lib/queue';

async function main() {
  console.log('Retrying failed generate-todo-title jobs using pg-boss...\n');

  try {
    // Use pg-boss's built-in retry functionality
    const result = await jobQueue.boss.retry('generate-todo-title');

    console.log(`✅ Successfully queued ${result.jobs} jobs for retry`);
    console.log(`Requested: ${result.requested}`);
    console.log(`Retried: ${result.retried}`);
  } catch (error) {
    console.error('Error retrying jobs:', error.message);
  }

  // Give time for queue to process
  console.log('\nWaiting 5 seconds to check job status...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check status
  const counts = await jobQueue.boss.getQueueSize('generate-todo-title');
  console.log('\nCurrent queue status:');
  console.log(`Active jobs: ${counts}`);

  process.exit(0);
}

main().catch(console.error);