#!/usr/bin/env bun

import { db } from '@agios/db';
import { projects, personas } from '@agios/db';
import { eq } from 'drizzle-orm';

const projectId = '0ebfac28-1680-4ec1-a587-836660140055';

async function main() {
  const existingProject = await db.select().from(projects).where(eq(projects.id, projectId));

  if (existingProject.length > 0) {
    console.log('✅ Project exists:', existingProject[0]);
    const projectPersonas = await db.select().from(personas).where(eq(personas.projectId, projectId));
    console.log(`📋 Project has ${projectPersonas.length} persona(s):`, projectPersonas);
  } else {
    console.log('❌ Project does NOT exist in database');
    console.log('Creating project and default persona...');
    const firstWorkspace = await db.query.workspaces.findFirst();
    if (!firstWorkspace) {
      console.error('❌ No workspace found!');
      process.exit(1);
    }
    await db.insert(projects).values({
      id: projectId,
      name: `Project ${projectId.slice(0, 8)}`,
      workspaceId: firstWorkspace.id,
    }).onConflictDoNothing();
    console.log(`✅ Created project: ${projectId}`);
    await db.insert(personas).values({
      projectId,
      name: 'Default Assistant',
      slug: 'default-assistant',
      role: 'assistant',
      color: '#3B82F6',
      description: 'Default persona for this project',
      isDefault: true,
      isActive: true,
    }).onConflictDoNothing();
    console.log(`✅ Created default persona for project`);
  }

  const allProjects = await db.select().from(projects);
  console.log(`\n📊 Total projects: ${allProjects.length}`);
  for (const p of allProjects) {
    console.log(`  - ${p.id.slice(0, 12)}... : ${p.name}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
