/**
 * Research Worker
 * Background worker for executing AI research sessions
 */

import { jobQueue } from '../lib/queue';
import { researchAI } from '../modules/crm/services/research-ai';
import { db } from '@agios/db';
import { crmResearchSessions, crmContacts, crmAccounts } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

export interface ResearchJob {
  sessionId: string;
  workspaceId: string;
}

export async function registerResearchWorker() {
  await jobQueue.work<ResearchJob>(
    'execute-research',
    {
      teamSize: 1, // Sequential processing
      teamConcurrency: 1,
    },
    async (job) => {
      const { sessionId, workspaceId } = job.data;

      console.log(`🔬 Starting research session: ${sessionId}`);

      // Get session
      const session = await db.query.crmResearchSessions.findFirst({
        where: eq(crmResearchSessions.id, sessionId),
      });

      if (!session) {
        throw new Error('Research session not found');
      }

      // Get entity data
      let entityData;
      if (session.entityType === 'contact') {
        entityData = await db.query.crmContacts.findFirst({
          where: eq(crmContacts.id, session.entityId),
        });
      } else {
        entityData = await db.query.crmAccounts.findFirst({
          where: eq(crmAccounts.id, session.entityId),
        });
      }

      if (!entityData) {
        throw new Error('Entity not found');
      }

      // Execute research
      await researchAI.executeResearch(sessionId, {
        entityType: session.entityType as 'contact' | 'account',
        entityData,
        objective: session.objective,
        maxQueries: session.maxQueries || 10,
      });

      console.log(`✅ Research session completed: ${sessionId}`);
    }
  );

  console.log('✅ Research worker registered');
}
