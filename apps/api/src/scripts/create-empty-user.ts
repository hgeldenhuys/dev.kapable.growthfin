/**
 * Script to create a test user with no workspaces for testing "Waiting for Invitation" screen
 */

import { db } from '@agios/db/client';
import { users } from '@agios/db';
import { eq } from 'drizzle-orm';

const EMPTY_USER_ID = '00000000-0000-0000-0000-000000000002';
const EMPTY_USER_EMAIL = 'empty@agios.ai';

async function createEmptyUser() {
  console.log('🌱 Creating empty user...');

  // Check if user exists
  const existingUsers = await db.select().from(users).where(eq(users.id, EMPTY_USER_ID));

  if (existingUsers.length === 0) {
    console.log('Creating empty user...');
    await db.insert(users).values({
      id: EMPTY_USER_ID,
      email: EMPTY_USER_EMAIL,
      name: 'Empty User',
    });
    console.log('✅ Empty user created');
  } else {
    console.log('✅ Empty user already exists');
  }

  console.log('🎉 Done!');
}

createEmptyUser()
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
