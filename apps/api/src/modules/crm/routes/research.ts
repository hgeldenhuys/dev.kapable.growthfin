/**
 * Research Routes
 * API endpoints for AI-powered contact enrichment
 */

import { Elysia, t } from 'elysia';
import {
  crmResearchSessions,
  crmResearchQueries,
  crmResearchFindings,
  crmContacts,
} from '@agios/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { jobQueue } from '../../../lib/queue';
import { timelineService } from '../services/timeline';
import {
  prepareEnrichmentUpdates,
  canApplyFinding,
  ENRICHMENT_FIELD_MAP,
} from '../services/enrichment-mapping';

export const researchRoutes = new Elysia({ prefix: '/research' })

  // POST /research/sessions - Create research session
  .post(
    '/sessions',
    async ({ body, db }) => {
      const { workspaceId, userId, entityType, entityId, objective, scope = 'basic' } = body;

      // Create session
      const [session] = await db
        .insert(crmResearchSessions)
        .values({
          workspaceId,
          entityType,
          entityId,
          objective,
          scope,
          status: 'pending',
          maxQueries: scope === 'deep' ? 30 : 10,
          createdBy: userId,
        })
        .returning();

      // Timeline event
      await timelineService.create(db, {
        workspaceId,
        entityType: entityType as any,
        entityId,
        eventType: 'research.session_created',
        eventCategory: 'system',
        eventLabel: 'Research Session Created',
        summary: `Research session started: ${objective}`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: userId,
        actorName: 'User',
        metadata: { sessionId: session.id, objective, scope },
      });

      return session;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        entityType: t.String(),
        entityId: t.String(),
        objective: t.String(),
        scope: t.Optional(t.String()),
      }),
    }
  )

  // POST /research/sessions/:id/start - Start research execution
  .post('/sessions/:id/start', async ({ params, body, db }) => {
    const { workspaceId } = body;
    const session = await db.query.crmResearchSessions.findFirst({
      where: and(
        eq(crmResearchSessions.id, params.id),
        eq(crmResearchSessions.workspaceId, workspaceId)
      ),
    });

    if (!session) {
      throw new Error('Session not found');
    }
    if (session.status !== 'pending') {
      throw new Error('Session already started');
    }

    // Enqueue research job
    await jobQueue.send('execute-research', {
      sessionId: session.id,
      workspaceId: workspaceId,
    });

    return { success: true, status: 'queued' };
  }, {
    body: t.Object({
      workspaceId: t.String(),
    }),
  })

  // GET /research/sessions - List sessions
  .get('/sessions', async ({ query, db }) => {
    const { workspaceId } = query;
    const sessions = await db.query.crmResearchSessions.findMany({
      where: and(
        eq(crmResearchSessions.workspaceId, workspaceId),
        isNull(crmResearchSessions.deletedAt)
      ),
      orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
      with: {
        queries: true,
        findings: true,
      },
    });

    return sessions;
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
  })

  // GET /research/sessions/:id - Get session detail
  .get('/sessions/:id', async ({ params, query, db }) => {
    const { workspaceId } = query;
    const session = await db.query.crmResearchSessions.findFirst({
      where: and(
        eq(crmResearchSessions.id, params.id),
        eq(crmResearchSessions.workspaceId, workspaceId)
      ),
      with: {
        queries: true,
        findings: true,
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return session;
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
  })

  // POST /research/sessions/:id/stop - Stop running research
  .post('/sessions/:id/stop', async ({ params, body, db }) => {
    const { workspaceId } = body;
    const [session] = await db
      .update(crmResearchSessions)
      .set({ status: 'stopped', completedAt: new Date() })
      .where(
        and(
          eq(crmResearchSessions.id, params.id),
          eq(crmResearchSessions.workspaceId, workspaceId)
        )
      )
      .returning();

    if (!session) {
      throw new Error('Session not found');
    }

    return { success: true, session };
  }, {
    body: t.Object({
      workspaceId: t.String(),
    }),
  })

  // GET /research/sessions/:id/findings - Get session findings
  .get('/sessions/:id/findings', async ({ params, query, db }) => {
    const { workspaceId } = query;
    const session = await db.query.crmResearchSessions.findFirst({
      where: and(
        eq(crmResearchSessions.id, params.id),
        eq(crmResearchSessions.workspaceId, workspaceId)
      ),
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const findings = await db.query.crmResearchFindings.findMany({
      where: eq(crmResearchFindings.sessionId, params.id),
      orderBy: (findings, { desc }) => [desc(findings.confidence)],
    });

    return findings;
  }, {
    query: t.Object({
      workspaceId: t.String(),
    }),
  })

  // POST /research/findings/:id/approve - Approve a finding
  .post('/findings/:id/approve', async ({ params, body, db }) => {
    const { workspaceId, userId } = body;
    const finding = await db.query.crmResearchFindings.findFirst({
      where: and(
        eq(crmResearchFindings.id, params.id),
        eq(crmResearchFindings.workspaceId, workspaceId)
      ),
    });

    if (!finding) {
      throw new Error('Finding not found');
    }

    const [updated] = await db
      .update(crmResearchFindings)
      .set({
        status: 'approved',
        reviewedBy: userId,
        reviewedAt: new Date(),
      })
      .where(eq(crmResearchFindings.id, params.id))
      .returning();

    return updated;
  }, {
    body: t.Object({
      workspaceId: t.String(),
      userId: t.String(),
    }),
  })

  // POST /research/findings/:id/reject - Reject a finding
  .post(
    '/findings/:id/reject',
    async ({ params, body, db }) => {
      const { workspaceId, userId, notes } = body;
      const finding = await db.query.crmResearchFindings.findFirst({
        where: and(
          eq(crmResearchFindings.id, params.id),
          eq(crmResearchFindings.workspaceId, workspaceId)
        ),
      });

      if (!finding) {
        throw new Error('Finding not found');
      }

      const [updated] = await db
        .update(crmResearchFindings)
        .set({
          status: 'rejected',
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: notes,
        })
        .where(eq(crmResearchFindings.id, params.id))
        .returning();

      return updated;
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
        notes: t.Optional(t.String()),
      }),
    }
  )

  // GET /research/sessions/:id/preview - Preview what would be applied
  .get(
    '/sessions/:id/preview',
    async ({ params, query, db }) => {
      const { workspaceId } = query;
      const session = await db.query.crmResearchSessions.findFirst({
        where: and(
          eq(crmResearchSessions.id, params.id),
          eq(crmResearchSessions.workspaceId, workspaceId)
        ),
      });

      if (!session) {
        throw new Error('Session not found');
      }

      const findings = await db.query.crmResearchFindings.findMany({
        where: and(
          eq(crmResearchFindings.sessionId, params.id),
          eq(crmResearchFindings.status, 'approved'),
          isNull(crmResearchFindings.appliedAt)
        ),
      });

      const { directFields, metadataFields, skippedFindings } = prepareEnrichmentUpdates(findings);

      return {
        findingsCount: findings.length,
        updates: {
          direct: directFields,
          metadata: metadataFields,
        },
        findings: findings.map(f => ({
          id: f.id,
          field: f.field,
          value: f.value,
          confidence: f.confidence,
          willApply: canApplyFinding(f.field, f.confidence),
          targetField: ENRICHMENT_FIELD_MAP[f.field]?.contactField,
          isMetadata: ENRICHMENT_FIELD_MAP[f.field]?.isMetadata,
        })),
        skipped: skippedFindings,
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
    }
  )

  // POST /research/sessions/:id/apply - Apply all approved findings to contact
  .post(
    '/sessions/:id/apply',
    async ({ params, body, db }) => {
      const { workspaceId, userId } = body;
      const session = await db.query.crmResearchSessions.findFirst({
        where: and(
          eq(crmResearchSessions.id, params.id),
          eq(crmResearchSessions.workspaceId, workspaceId)
        ),
      });

      if (!session) {
        throw new Error('Session not found');
      }

      // Get all approved findings for this session that haven't been applied
      const findings = await db.query.crmResearchFindings.findMany({
        where: and(
          eq(crmResearchFindings.sessionId, params.id),
          eq(crmResearchFindings.status, 'approved'),
          isNull(crmResearchFindings.appliedAt)
        ),
      });

      if (findings.length === 0) {
        return { applied: 0, message: 'No unapplied approved findings' };
      }

      // Prepare enrichment updates
      const { directFields, metadataFields, skippedFindings } = prepareEnrichmentUpdates(findings);

      // Get current contact
      const contact = await db.query.crmContacts.findFirst({
        where: and(
          eq(crmContacts.id, session.entityId),
          eq(crmContacts.workspaceId, workspaceId)
        ),
      });

      if (!contact) {
        throw new Error('Contact not found');
      }

      // Merge metadata (preserve existing + add new)
      const updatedCustomFields = {
        ...(contact.customFields || {}),
        ...metadataFields,
      };

      // Update contact
      await db
        .update(crmContacts)
        .set({
          ...directFields,
          customFields: updatedCustomFields,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, session.entityId));

      // Mark findings as applied (only those that were actually applied)
      const appliedFindingIds = findings
        .filter(f => canApplyFinding(f.field, f.confidence))
        .map(f => f.id);

      if (appliedFindingIds.length > 0) {
        await db
          .update(crmResearchFindings)
          .set({
            applied: true,
            appliedAt: new Date(),
            appliedBy: userId,
          })
          .where(inArray(crmResearchFindings.id, appliedFindingIds));
      }

      // Create timeline event
      await timelineService.create(db, {
        workspaceId,
        entityType: 'contact',
        entityId: session.entityId,
        eventType: 'enrichment.applied',
        eventCategory: 'system',
        eventLabel: 'Enrichments Applied',
        summary: `Applied ${appliedFindingIds.length} research findings to contact`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: userId,
        actorName: 'User',
        metadata: {
          sessionId: session.id,
          findingsCount: appliedFindingIds.length,
          fields: Object.keys({ ...directFields, ...metadataFields }),
          skipped: skippedFindings,
        },
      });

      return {
        applied: appliedFindingIds.length,
        skipped: skippedFindings.length,
        fields: Object.keys({ ...directFields, ...metadataFields }),
        details: {
          directFields: Object.keys(directFields),
          metadataFields: Object.keys(metadataFields),
        },
      };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
      }),
    }
  )

  // POST /research/findings/:id/apply-single - Apply single finding
  .post(
    '/findings/:id/apply-single',
    async ({ params, body, db }) => {
      const { workspaceId, userId } = body;
      const finding = await db.query.crmResearchFindings.findFirst({
        where: and(
          eq(crmResearchFindings.id, params.id),
          eq(crmResearchFindings.workspaceId, workspaceId)
        ),
        with: { session: true },
      });

      if (!finding) {
        throw new Error('Finding not found');
      }

      if (finding.status !== 'approved') {
        throw new Error('Only approved findings can be applied');
      }

      if (finding.appliedAt) {
        throw new Error('Finding already applied');
      }

      // Prepare enrichment
      const { directFields, metadataFields, skippedFindings } = prepareEnrichmentUpdates([finding]);

      if (Object.keys(directFields).length === 0 && Object.keys(metadataFields).length === 0) {
        throw new Error(`Cannot apply finding: ${skippedFindings[0]?.reason || 'Unknown error'}`);
      }

      // Get contact
      const contact = await db.query.crmContacts.findFirst({
        where: and(
          eq(crmContacts.id, finding.session.entityId),
          eq(crmContacts.workspaceId, workspaceId)
        ),
      });

      if (!contact) {
        throw new Error('Contact not found');
      }

      // Update contact
      const updatedCustomFields = {
        ...(contact.customFields || {}),
        ...metadataFields,
      };

      await db
        .update(crmContacts)
        .set({
          ...directFields,
          customFields: updatedCustomFields,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, finding.session.entityId));

      // Mark finding as applied
      await db
        .update(crmResearchFindings)
        .set({
          applied: true,
          appliedAt: new Date(),
          appliedBy: userId,
        })
        .where(eq(crmResearchFindings.id, params.id));

      // Create timeline event
      await timelineService.create(db, {
        workspaceId,
        entityType: 'contact',
        entityId: finding.session.entityId,
        eventType: 'enrichment.applied',
        eventCategory: 'data',
        eventLabel: 'Finding Applied',
        summary: `Applied research finding: ${finding.field} = ${finding.value}`,
        occurredAt: new Date(),
        actorType: 'user',
        actorId: userId,
        actorName: 'User',
        metadata: {
          findingId: finding.id,
          field: finding.field,
          value: finding.value,
          confidence: finding.confidence,
        },
      });

      return {
        applied: true,
        field: Object.keys({ ...directFields, ...metadataFields })[0],
        value: finding.value,
      };
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        userId: t.String(),
      }),
    }
  );
