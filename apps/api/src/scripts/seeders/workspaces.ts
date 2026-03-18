/**
 * Workspaces Seeder
 * Creates test workspaces for development environment
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { workspaces, workspaceMembers } from '@agios/db';
import type { Seeder, SeederResult } from './index';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

const TEST_WORKSPACES = [
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

/**
 * Seed test workspaces (development only)
 */
async function seedWorkspaces(db: NodePgDatabase<any>): Promise<SeederResult> {
  let created = 0;
  let skipped = 0;

  for (const workspace of TEST_WORKSPACES) {
    // Check if workspace exists
    const existing = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⏭️  ${workspace.name} (already exists)`);
      skipped++;
      continue;
    }

    // Create workspace
    await db.insert(workspaces).values(workspace);

    // Add test user as owner
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: TEST_USER_ID,
      role: 'owner',
      status: 'active',
    });

    console.log(`  ✅ ${workspace.name}`);
    created++;
  }

  return { created, skipped };
}

export const workspacesSeeder: Seeder = {
  name: 'workspaces',
  description: 'Test workspaces for development environment',
  environments: ['development'], // Development only
  run: seedWorkspaces,
};
