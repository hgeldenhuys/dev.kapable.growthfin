/**
 * Projects Service
 * Business logic for project operations
 */

import type { Database } from '@agios/db';
import { projects } from '@agios/db';
import { eq } from 'drizzle-orm';

export const projectService = {
  async list(db: Database) {
    return db.select({
      id: projects.id,
      name: projects.name,
      workspaceId: projects.workspaceId,
      gitRepo: projects.gitRepo,
      machineHost: projects.machineHost,
      gitUser: projects.gitUser,
      gitBranch: projects.gitBranch,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    }).from(projects);
  },

  async getById(db: Database, id: string) {
    const results = await db.select().from(projects).where(eq(projects.id, id));
    return results[0] || null;
  },

  async updateGitDetails(db: Database, id: string, gitDetails: {
    gitRepo: string | null;
    machineHost: string | null;
    gitUser: string | null;
    gitBranch?: string | null;
  }) {
    const results = await db
      .update(projects)
      .set({
        name: gitDetails.gitRepo || `Project ${id.slice(0, 8)}`, // Update name to match gitRepo
        gitRepo: gitDetails.gitRepo,
        machineHost: gitDetails.machineHost,
        gitUser: gitDetails.gitUser,
        gitBranch: gitDetails.gitBranch || null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    return results[0] || null;
  },
};
