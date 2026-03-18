/**
 * Seed script to create test workspaces for testing UI
 */

import { db } from '@agios/db/client';
import { workspaces, workspaceMembers, users } from '@agios/db';
import { eq } from 'drizzle-orm';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_EMAIL = 'dev@agios.ai';

async function seed() {
  console.log('🌱 Seeding test workspaces...');

  // Check if user exists, create if not
  const existingUsers = await db.select().from(users).where(eq(users.id, TEST_USER_ID));

  if (existingUsers.length === 0) {
    console.log('Creating test user...');
    await db.insert(users).values({
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      name: 'Developer',
    });
    console.log('✅ Test user created');
  } else {
    console.log('✅ Test user already exists');
  }

  // Create test workspaces
  const testWorkspaces = [
    {
      id: '22591eea-a103-4306-9c79-9a2d7b666af4',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      ownerId: TEST_USER_ID,
    },
    {
      id: 'b8f3c1d2-4e5f-6789-a012-bcdef3456789',
      name: 'Beta Industries',
      slug: 'beta-industries',
      ownerId: TEST_USER_ID,
    },
    {
      id: 'c9d4e2f3-5a6b-7890-b123-cdef45678901',
      name: 'Gamma Solutions',
      slug: 'gamma-solutions',
      ownerId: TEST_USER_ID,
    },
  ];

  for (const workspace of testWorkspaces) {
    // Check if workspace exists
    const existing = await db.select().from(workspaces).where(eq(workspaces.id, workspace.id));

    if (existing.length === 0) {
      console.log(`Creating workspace: ${workspace.name}`);
      await db.insert(workspaces).values(workspace);

      // Add user as owner
      await db.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: TEST_USER_ID,
        role: 'owner',
        status: 'active',
      });

      console.log(`✅ Created workspace: ${workspace.name}`);
    } else {
      console.log(`✅ Workspace already exists: ${workspace.name}`);
    }
  }

  console.log('🎉 Seeding complete!');
}

seed()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
