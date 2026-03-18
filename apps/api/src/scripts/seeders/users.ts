/**
 * Users Seeder
 * Creates test users for development environment
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { users } from '@agios/db';
import type { Seeder, SeederResult } from './index';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_EMAIL = 'dev@agios.ai';

/**
 * Seed test users (development only)
 */
async function seedUsers(db: NodePgDatabase<any>): Promise<SeederResult> {
  let created = 0;
  let skipped = 0;

  // Check if test user exists
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.id, TEST_USER_ID))
    .limit(1);

  if (existingUsers.length > 0) {
    console.log('  ⏭️  Test user already exists');
    skipped++;
  } else {
    // Create test user
    await db.insert(users).values({
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      name: 'Developer',
    });

    console.log(`  ✅ Created test user: ${TEST_USER_EMAIL}`);
    created++;
  }

  return { created, skipped };
}

export const usersSeeder: Seeder = {
  name: 'users',
  description: 'Test users for development environment',
  environments: ['development'], // Development only
  run: seedUsers,
};
