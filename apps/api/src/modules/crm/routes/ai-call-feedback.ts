/**
 * AI Call Feedback Routes
 * Phase M: AI Call Training/Feedback
 *
 * Endpoints for submitting and retrieving call feedback.
 */

import { Elysia, t } from 'elysia';
import { eq, and, desc, sql } from 'drizzle-orm';
import { crmAiCallFeedback, crmAiCalls, crmAiCallScripts, FEEDBACK_TAGS, type FeedbackTag } from '@agios/db/schema';

export const aiCallFeedbackRoutes = new Elysia({ prefix: '/ai-calls' })
  /**
   * POST /:id/feedback - Submit feedback for a call
   */
  .post(
    '/:id/feedback',
    async ({ db, params, body, set }) => {
      // Verify the AI call exists
      const [aiCall] = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.id, params.id),
            eq(crmAiCalls.workspaceId, body.workspaceId)
          )
        )
        .limit(1);

      if (!aiCall) {
        set.status = 404;
        return { error: 'AI call not found' };
      }

      // Check if feedback already exists for this call
      const existingFeedback = await db
        .select()
        .from(crmAiCallFeedback)
        .where(eq(crmAiCallFeedback.aiCallId, params.id))
        .limit(1);

      if (existingFeedback.length > 0) {
        // Update existing feedback
        const [updated] = await db
          .update(crmAiCallFeedback)
          .set({
            rating: body.rating,
            feedbackText: body.feedbackText,
            feedbackTags: body.feedbackTags,
            updatedAt: new Date(),
          })
          .where(eq(crmAiCallFeedback.id, existingFeedback[0].id))
          .returning();

        return { feedback: updated, updated: true };
      }

      // Create new feedback
      const [feedback] = await db.insert(crmAiCallFeedback).values({
        aiCallId: params.id,
        workspaceId: body.workspaceId,
        rating: body.rating,
        feedbackText: body.feedbackText,
        feedbackTags: body.feedbackTags || [],
        createdBy: body.userId,
      }).returning();

      // Update script success rate if we have the script info
      if (aiCall.scriptId && body.rating) {
        await updateScriptSuccessRate(db, aiCall.scriptId);
      }

      return { feedback, updated: false };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        rating: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
        feedbackText: t.Optional(t.String()),
        feedbackTags: t.Optional(t.Array(t.String())),
        userId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI Calls', 'Feedback'],
        summary: 'Submit call feedback',
        description: 'Submit or update feedback for an AI call including rating and tags',
      },
    }
  )

  /**
   * GET /:id/feedback - Get feedback for a call
   */
  .get(
    '/:id/feedback',
    async ({ db, params, query, set }) => {
      const [feedback] = await db
        .select()
        .from(crmAiCallFeedback)
        .where(
          and(
            eq(crmAiCallFeedback.aiCallId, params.id),
            eq(crmAiCallFeedback.workspaceId, query.workspaceId)
          )
        )
        .limit(1);

      if (!feedback) {
        return { feedback: null };
      }

      return { feedback };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Calls', 'Feedback'],
        summary: 'Get call feedback',
        description: 'Get feedback for a specific AI call',
      },
    }
  );

/**
 * Script feedback routes
 */
export const aiCallScriptFeedbackRoutes = new Elysia({ prefix: '/ai-call-scripts' })
  /**
   * GET /:id/feedback-summary - Get aggregated feedback for a script
   */
  .get(
    '/:id/feedback-summary',
    async ({ db, params, query, set }) => {
      // Get the script
      const [script] = await db
        .select()
        .from(crmAiCallScripts)
        .where(
          and(
            eq(crmAiCallScripts.id, params.id),
            eq(crmAiCallScripts.workspaceId, query.workspaceId)
          )
        )
        .limit(1);

      if (!script) {
        set.status = 404;
        return { error: 'Script not found' };
      }

      // Get all AI calls that used this script
      const aiCalls = await db
        .select()
        .from(crmAiCalls)
        .where(
          and(
            eq(crmAiCalls.workspaceId, query.workspaceId),
            eq(crmAiCalls.scriptId, params.id)
          )
        );

      const aiCallIds = aiCalls.map(c => c.id);

      if (aiCallIds.length === 0) {
        return {
          scriptId: params.id,
          totalFeedback: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          tagCounts: {},
          recentFeedback: [],
        };
      }

      // Get all feedback for these calls
      const feedbackList = await db
        .select()
        .from(crmAiCallFeedback)
        .where(sql`${crmAiCallFeedback.aiCallId} = ANY(${aiCallIds})`)
        .orderBy(desc(crmAiCallFeedback.createdAt));

      // Calculate metrics
      const totalFeedback = feedbackList.length;
      const ratingsWithValues = feedbackList.filter(f => f.rating !== null);
      const averageRating = ratingsWithValues.length > 0
        ? ratingsWithValues.reduce((sum, f) => sum + (f.rating || 0), 0) / ratingsWithValues.length
        : 0;

      // Rating distribution
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const feedback of feedbackList) {
        if (feedback.rating && feedback.rating >= 1 && feedback.rating <= 5) {
          ratingDistribution[feedback.rating as 1 | 2 | 3 | 4 | 5]++;
        }
      }

      // Tag counts
      const tagCounts: Record<string, number> = {};
      for (const feedback of feedbackList) {
        const tags = feedback.feedbackTags as string[] || [];
        for (const tag of tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }

      // Recent feedback (last 10)
      const recentFeedback = feedbackList.slice(0, 10).map(f => ({
        rating: f.rating,
        feedbackText: f.feedbackText,
        createdAt: f.createdAt,
      }));

      return {
        scriptId: params.id,
        totalFeedback,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution,
        tagCounts,
        recentFeedback,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Calls', 'Scripts', 'Feedback'],
        summary: 'Get script feedback summary',
        description: 'Get aggregated feedback metrics for a script',
      },
    }
  )

  /**
   * POST /:id/variants - Create A/B test variant
   */
  .post(
    '/:id/variants',
    async ({ db, params, body, set }) => {
      // Get the parent script
      const [parentScript] = await db
        .select()
        .from(crmAiCallScripts)
        .where(
          and(
            eq(crmAiCallScripts.id, params.id),
            eq(crmAiCallScripts.workspaceId, body.workspaceId)
          )
        )
        .limit(1);

      if (!parentScript) {
        set.status = 404;
        return { error: 'Parent script not found' };
      }

      // If parent isn't marked as control, mark it
      if (!parentScript.isControl) {
        await db
          .update(crmAiCallScripts)
          .set({
            isControl: true,
            variantName: 'Control',
            updatedAt: new Date(),
          })
          .where(eq(crmAiCallScripts.id, params.id));
      }

      // Count existing variants
      const existingVariants = await db
        .select()
        .from(crmAiCallScripts)
        .where(eq(crmAiCallScripts.parentScriptId, params.id));

      const variantLetter = String.fromCharCode(65 + existingVariants.length); // A, B, C, etc.
      const variantName = body.variantName || `Variant ${variantLetter}`;

      // Create the variant
      const [variant] = await db.insert(crmAiCallScripts).values({
        workspaceId: body.workspaceId,
        agentId: parentScript.agentId,
        name: `${parentScript.name} - ${variantName}`,
        description: body.description || parentScript.description,
        purpose: parentScript.purpose,
        objective: body.objective || parentScript.objective,
        opening: body.opening || parentScript.opening,
        talkingPoints: body.talkingPoints || parentScript.talkingPoints,
        objectionHandlers: body.objectionHandlers || parentScript.objectionHandlers,
        qualifyingQuestions: body.qualifyingQuestions || parentScript.qualifyingQuestions,
        closing: body.closing || parentScript.closing,
        endConditions: body.endConditions || parentScript.endConditions,
        systemPrompt: body.systemPrompt || parentScript.systemPrompt,
        voiceStyle: body.voiceStyle || parentScript.voiceStyle,
        isActive: true,
        isDefault: false,
        parentScriptId: params.id,
        variantName,
        isControl: false,
        variantWeight: body.variantWeight || 50, // 50% by default
      }).returning();

      return { variant };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        workspaceId: t.String(),
        variantName: t.Optional(t.String()),
        description: t.Optional(t.String()),
        objective: t.Optional(t.String()),
        opening: t.Optional(t.String()),
        talkingPoints: t.Optional(t.Array(t.String())),
        objectionHandlers: t.Optional(t.Record(t.String(), t.String())),
        qualifyingQuestions: t.Optional(t.Array(t.String())),
        closing: t.Optional(t.String()),
        endConditions: t.Optional(t.Any()),
        systemPrompt: t.Optional(t.String()),
        voiceStyle: t.Optional(t.Any()),
        variantWeight: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
      }),
      detail: {
        tags: ['AI Calls', 'Scripts', 'A/B Testing'],
        summary: 'Create script variant',
        description: 'Create an A/B test variant of a script',
      },
    }
  )

  /**
   * GET /:id/variants - List variants for a script
   */
  .get(
    '/:id/variants',
    async ({ db, params, query }) => {
      // Get the control script
      const [control] = await db
        .select()
        .from(crmAiCallScripts)
        .where(
          and(
            eq(crmAiCallScripts.id, params.id),
            eq(crmAiCallScripts.workspaceId, query.workspaceId)
          )
        )
        .limit(1);

      if (!control) {
        return { control: null, variants: [] };
      }

      // Get all variants
      const variants = await db
        .select()
        .from(crmAiCallScripts)
        .where(eq(crmAiCallScripts.parentScriptId, params.id))
        .orderBy(crmAiCallScripts.createdAt);

      return { control, variants };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['AI Calls', 'Scripts', 'A/B Testing'],
        summary: 'List script variants',
        description: 'List all A/B test variants for a script',
      },
    }
  );

/**
 * Feedback tags endpoint
 */
export const feedbackTagsRoutes = new Elysia({ prefix: '/feedback-tags' })
  .get(
    '/',
    async () => {
      return { tags: FEEDBACK_TAGS };
    },
    {
      detail: {
        tags: ['AI Calls', 'Feedback'],
        summary: 'Get available feedback tags',
        description: 'Returns the list of predefined feedback tags',
      },
    }
  );

/**
 * Update script success rate based on feedback
 */
async function updateScriptSuccessRate(db: any, scriptId: string): Promise<void> {
  // Get all AI calls for this script
  const aiCalls = await db
    .select()
    .from(crmAiCalls)
    .where(eq(crmAiCalls.scriptId, scriptId));

  if (aiCalls.length === 0) return;

  const aiCallIds = aiCalls.map((c: { id: string }) => c.id);

  // Get all feedback for these calls
  const feedbackList = await db
    .select()
    .from(crmAiCallFeedback)
    .where(sql`${crmAiCallFeedback.aiCallId} = ANY(${aiCallIds})`);

  const ratingsWithValues = feedbackList.filter((f: { rating: number | null }) => f.rating !== null);
  if (ratingsWithValues.length === 0) return;

  // Calculate success rate (ratings 4-5 are considered success)
  const successfulCalls = ratingsWithValues.filter((f: { rating: number | null }) => (f.rating || 0) >= 4).length;
  const successRate = (successfulCalls / ratingsWithValues.length) * 100;

  // Update script
  await db
    .update(crmAiCallScripts)
    .set({
      successRate: successRate.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(crmAiCallScripts.id, scriptId));
}
