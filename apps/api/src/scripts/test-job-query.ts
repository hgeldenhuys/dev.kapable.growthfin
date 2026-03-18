#!/usr/bin/env bun
import { db } from '@agios/db/client';

async function main() {
  console.log('Testing pgboss job query...\n');

  try {
    // Try simple query first
    const result = await db.execute(`
      SELECT COUNT(*) as count
      FROM pgboss.job
      WHERE name = 'generate-todo-title'
    `);

    console.log('Query result:', result);

    if (result && result.length > 0) {
      console.log('Total jobs:', result[0].count);

      // Now check for failed ones
      const failedResult = await db.execute(`
        SELECT COUNT(*) as count
        FROM pgboss.job
        WHERE name = 'generate-todo-title'
          AND state = 'failed'
      `);

      if (failedResult && failedResult.length > 0) {
        console.log('Failed jobs:', failedResult[0].count);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

main();