#!/usr/bin/env bun
import { jobQueue } from '../lib/queue';
import { db } from '@agios/db/client';
import { claudeSessions, hookEvents } from '@agios/db/schema';
import { randomUUID } from 'crypto';

async function main() {
  console.log('Testing todo title generation with fixed configuration...\n');

  try {
    // Start the job queue
    await jobQueue.start();

    // Create a test session with todos
    const sessionId = randomUUID();
    const projectId = '0ebfac28-1680-4ec1-a587-836660140055'; // From your project
    const userPromptSubmitEventId = randomUUID();

    // Insert test session with todos
    await db.insert(claudeSessions).values({
      id: sessionId,
      projectId,
      startTime: new Date(),
      todos: [
        { content: 'Fix LLM configuration issue', status: 'completed' },
        { content: 'Update provider from openapi to anthropic', status: 'completed' },
        { content: 'Test the job queue with new configuration', status: 'in_progress' }
      ]
    });

    console.log(`Created test session: ${sessionId}`);

    // Insert test hook event for user prompt
    await db.insert(hookEvents).values({
      id: userPromptSubmitEventId,
      sessionId,
      projectId,
      eventName: 'UserPromptSubmit',
      payload: {
        message: 'Fix the generate-todo-title job that was failing due to missing API URL configuration'
      },
      createdAt: new Date()
    });

    console.log(`Created test event: ${userPromptSubmitEventId}`);

    // Send the job
    const jobId = await jobQueue.send('generate-todo-title', {
      sessionId,
      projectId,
      userPromptSubmitEventId
    });

    console.log(`\n✅ Job sent successfully: ${jobId}`);
    console.log('Waiting 10 seconds for job to process...\n');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check if the session was updated with a title
    const updatedSession = await db.query.claudeSessions.findFirst({
      where: (sessions, { eq }) => eq(sessions.id, sessionId)
    });

    if (updatedSession?.generatedTitle) {
      console.log('🎉 SUCCESS! Title generated:');
      console.log(`Title: "${updatedSession.generatedTitle}"`);
    } else {
      console.log('❌ No title generated yet. Checking job status...');

      // Check job status
      const jobStatus = await db.execute(`
        SELECT state, retry_count, output::text as output
        FROM pgboss.job
        WHERE id = $1
      `, [jobId]);

      if (jobStatus.length > 0) {
        const job = jobStatus[0];
        console.log(`Job state: ${job.state}`);
        console.log(`Retry count: ${job.retry_count}`);
        if (job.output) {
          console.log(`Job output: ${job.output}`);
        }
      }
    }

    // Clean up test data
    console.log('\nCleaning up test data...');
    await db.execute(`DELETE FROM claude_sessions WHERE id = $1`, [sessionId]);
    await db.execute(`DELETE FROM hook_events WHERE id = $1`, [userPromptSubmitEventId]);

    await jobQueue.stop();
    console.log('Test complete!');

  } catch (error) {
    console.error('Test failed:', error);
    await jobQueue.stop();
  }

  process.exit(0);
}

main().catch(console.error);