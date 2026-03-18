/**
 * A/B Testing Service
 * Business logic for campaign A/B testing and winner selection
 */

import type { Database } from '@agios/db';
import {
  crmAbTestResults,
  crmCampaignRecipients,
  crmCampaignMessages,
  type ABTestWinningCriteria,
  type NewCrmAbTestResult,
} from '@agios/db';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import {
  chiSquareTest,
  hasMinimumSampleSize,
  confidenceInterval,
  calculateLift,
} from '../utils/statistics';

/**
 * Deterministic hash-based variant assignment
 * Same lead/contact ID always gets same variant (consistent across tests)
 *
 * @param identifier - Unique identifier (contactId or leadId)
 * @param campaignId - Campaign ID for campaign-specific hashing
 * @param totalPercentage - Total percentage to assign (0-100)
 * @returns Percentage bucket (0-100) the identifier falls into
 */
function hashToPercentage(identifier: string, campaignId: string, totalPercentage: number = 100): number {
  // Create deterministic hash from contact + campaign
  const hash = createHash('sha256')
    .update(`${identifier}:${campaignId}`)
    .digest('hex');

  // Convert first 8 hex chars to integer
  const hashInt = parseInt(hash.substring(0, 8), 16);

  // Map to percentage (0-100)
  const percentage = (hashInt % 10000) / 100; // 0.00 to 99.99

  // Scale to totalPercentage
  return (percentage / 100) * totalPercentage;
}

/**
 * Assign a lead/contact to a variant deterministically
 *
 * @param identifier - Lead or contact ID
 * @param campaignId - Campaign ID
 * @param variants - Array of variants with trafficPercentage
 * @returns The assigned variant
 */
function assignVariantDeterministically<T extends { testPercentage: number | null }>(
  identifier: string,
  campaignId: string,
  variants: T[]
): T {
  // Calculate the hash percentage for this identifier
  const hashPercentage = hashToPercentage(identifier, campaignId, 100);

  // Find which variant bucket it falls into
  let cumulative = 0;
  for (const variant of variants) {
    const percentage = variant.testPercentage || 0;
    cumulative += percentage;

    if (hashPercentage < cumulative) {
      return variant;
    }
  }

  // Fallback to last variant (handles rounding)
  return variants[variants.length - 1];
}

/**
 * Distribute recipients across message variants based on test percentages
 * Uses deterministic hash-based assignment (same contact always gets same variant)
 * Returns a map of recipientId -> messageId
 */
export async function distributeRecipients(
  db: Database,
  campaignId: string,
  workspaceId: string
): Promise<Map<string, { messageId: string; variantName: string }>> {
  // Get all messages for this campaign with variant info
  const messages = await db
    .select()
    .from(crmCampaignMessages)
    .where(
      and(
        eq(crmCampaignMessages.campaignId, campaignId),
        eq(crmCampaignMessages.workspaceId, workspaceId),
        isNull(crmCampaignMessages.deletedAt)
      )
    );

  if (messages.length === 0) {
    throw new Error('No messages found for campaign');
  }

  // Get all pending recipients
  const recipients = await db
    .select()
    .from(crmCampaignRecipients)
    .where(
      and(
        eq(crmCampaignRecipients.campaignId, campaignId),
        eq(crmCampaignRecipients.workspaceId, workspaceId),
        eq(crmCampaignRecipients.status, 'pending')
      )
    );

  if (recipients.length === 0) {
    return new Map();
  }

  // Calculate distribution
  const distribution = new Map<string, { messageId: string; variantName: string }>();

  // If only one message, assign all recipients to it
  if (messages.length === 1) {
    const message = messages[0];
    for (const recipient of recipients) {
      distribution.set(recipient.id, {
        messageId: message.id,
        variantName: message.variantName || 'A',
      });
    }
    return distribution;
  }

  // Calculate percentages
  const hasPercentages = messages.some((m) => m.testPercentage !== null && m.testPercentage !== undefined);

  if (hasPercentages) {
    // Use specified test percentages
    const totalPercentage = messages.reduce((sum, m) => sum + (m.testPercentage || 0), 0);
    if (Math.abs(totalPercentage - 100) > 1) {
      throw new Error(`Test percentages must sum to 100 (currently ${totalPercentage})`);
    }

    // Use deterministic hash-based assignment
    // Each recipient gets assigned based on hash of their contactId + campaignId
    for (const recipient of recipients) {
      const assignedMessage = assignVariantDeterministically(
        recipient.contactId,
        campaignId,
        messages
      );

      distribution.set(recipient.id, {
        messageId: assignedMessage.id,
        variantName: assignedMessage.variantName || String.fromCharCode(65 + messages.indexOf(assignedMessage)),
      });
    }
  } else {
    // Equal distribution - assign equal test percentage to each variant
    const equalPercentage = 100 / messages.length;
    const messagesWithPercentages = messages.map(m => ({
      ...m,
      testPercentage: equalPercentage,
    }));

    // Use deterministic hash-based assignment
    for (const recipient of recipients) {
      const assignedMessage = assignVariantDeterministically(
        recipient.contactId,
        campaignId,
        messagesWithPercentages
      );

      // Find original message by id
      const originalMessage = messages.find(m => m.id === assignedMessage.id);
      if (!originalMessage) continue;

      distribution.set(recipient.id, {
        messageId: originalMessage.id,
        variantName: originalMessage.variantName || String.fromCharCode(65 + messages.indexOf(originalMessage)),
      });
    }
  }

  return distribution;
}

/**
 * Update A/B test results by calculating metrics from recipient data
 */
export async function updateTestResults(
  db: Database,
  campaignId: string,
  workspaceId: string
): Promise<void> {
  // Get all messages with variants for this campaign
  const messages = await db
    .select()
    .from(crmCampaignMessages)
    .where(
      and(
        eq(crmCampaignMessages.campaignId, campaignId),
        eq(crmCampaignMessages.workspaceId, workspaceId),
        isNull(crmCampaignMessages.deletedAt)
      )
    );

  // Calculate metrics for each variant
  for (const message of messages) {
    const variantName = message.variantName || 'A';

    // Aggregate recipient stats for this message variant
    const stats = await db
      .select({
        sentCount: sql<number>`COUNT(*) FILTER (WHERE status IN ('sent', 'delivered'))`.as('sent_count'),
        deliveredCount: sql<number>`COUNT(*) FILTER (WHERE status = 'delivered')`.as('delivered_count'),
        openedCount: sql<number>`COUNT(*) FILTER (WHERE open_count > 0)`.as('opened_count'),
        clickedCount: sql<number>`COUNT(*) FILTER (WHERE click_count > 0)`.as('clicked_count'),
        bouncedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'bounced')`.as('bounced_count'),
      })
      .from(crmCampaignRecipients)
      .where(
        and(
          eq(crmCampaignRecipients.campaignId, campaignId),
          eq(crmCampaignRecipients.messageId, message.id),
          eq(crmCampaignRecipients.workspaceId, workspaceId)
        )
      );

    const stat = stats[0];
    if (!stat) continue;

    const sentCount = Number(stat.sentCount) || 0;
    const deliveredCount = Number(stat.deliveredCount) || 0;
    const openedCount = Number(stat.openedCount) || 0;
    const clickedCount = Number(stat.clickedCount) || 0;
    const bouncedCount = Number(stat.bouncedCount) || 0;

    // Calculate rates
    const openRate = deliveredCount > 0 ? openedCount / deliveredCount : null;
    const clickRate = deliveredCount > 0 ? clickedCount / deliveredCount : null;
    const bounceRate = sentCount > 0 ? bouncedCount / sentCount : null;

    // Check if result already exists
    const existingResults = await db
      .select()
      .from(crmAbTestResults)
      .where(
        and(
          eq(crmAbTestResults.campaignId, campaignId),
          eq(crmAbTestResults.messageId, message.id),
          eq(crmAbTestResults.workspaceId, workspaceId)
        )
      );

    const resultData = {
      sentCount,
      deliveredCount,
      openedCount,
      clickedCount,
      bouncedCount,
      openRate: openRate ? String(openRate) : null,
      clickRate: clickRate ? String(clickRate) : null,
      bounceRate: bounceRate ? String(bounceRate) : null,
      updatedAt: new Date(),
    };

    if (existingResults.length > 0) {
      // Update existing result
      await db
        .update(crmAbTestResults)
        .set(resultData)
        .where(eq(crmAbTestResults.id, existingResults[0].id));
    } else {
      // Create new result
      const newResult: NewCrmAbTestResult = {
        workspaceId,
        campaignId,
        messageId: message.id,
        variantName,
        ...resultData,
      };
      await db.insert(crmAbTestResults).values(newResult);
    }
  }
}

/**
 * Declare a winner for an A/B test based on criteria
 */
export async function declareWinner(
  db: Database,
  campaignId: string,
  workspaceId: string,
  messageId: string,
  criteria: ABTestWinningCriteria
): Promise<void> {
  // First, update results to ensure we have latest metrics
  await updateTestResults(db, campaignId, workspaceId);

  // Clear any existing winners
  await db
    .update(crmAbTestResults)
    .set({
      isWinner: false,
      winnerDeclaredAt: null,
      winningCriteria: null,
    })
    .where(
      and(
        eq(crmAbTestResults.campaignId, campaignId),
        eq(crmAbTestResults.workspaceId, workspaceId)
      )
    );

  // Mark the selected message as winner
  await db
    .update(crmAbTestResults)
    .set({
      isWinner: true,
      winnerDeclaredAt: new Date(),
      winningCriteria: criteria,
    })
    .where(
      and(
        eq(crmAbTestResults.campaignId, campaignId),
        eq(crmAbTestResults.messageId, messageId),
        eq(crmAbTestResults.workspaceId, workspaceId)
      )
    );
}

/**
 * Get A/B test results for a campaign
 */
export async function getTestResults(
  db: Database,
  campaignId: string,
  workspaceId: string
) {
  const results = await db.query.crmAbTestResults.findMany({
    where: and(
      eq(crmAbTestResults.campaignId, campaignId),
      eq(crmAbTestResults.workspaceId, workspaceId)
    ),
    with: {
      message: true,
    },
    orderBy: (results, { desc }) => [desc(results.isWinner), desc(results.openRate)],
  });

  return results;
}

/**
 * Auto-declare winner based on statistical significance
 * Uses chi-square test to ensure results are statistically significant (p < 0.05)
 */
export async function autoDeclareWinner(
  db: Database,
  campaignId: string,
  workspaceId: string,
  criteria: ABTestWinningCriteria = 'open_rate',
  minSampleSize: number = 100
): Promise<{
  messageId: string;
  variantName: string;
  pValue: number;
  isSignificant: boolean;
  lift: number;
} | null> {
  await updateTestResults(db, campaignId, workspaceId);

  const results = await db
    .select()
    .from(crmAbTestResults)
    .where(
      and(
        eq(crmAbTestResults.campaignId, campaignId),
        eq(crmAbTestResults.workspaceId, workspaceId)
      )
    );

  if (results.length < 2) {
    return null; // Need at least 2 variants
  }

  // Check minimum sample size for EACH variant
  const sampleSizes = results.map(r => r.deliveredCount);
  const sampleValidation = hasMinimumSampleSize(sampleSizes, minSampleSize);

  if (!sampleValidation.isValid) {
    return null; // Not enough data in one or more variants
  }

  // Extract data based on criteria
  let observed: number[];
  let totals: number[];

  if (criteria === 'open_rate') {
    observed = results.map(r => r.openedCount);
    totals = results.map(r => r.deliveredCount);
  } else if (criteria === 'click_rate') {
    observed = results.map(r => r.clickedCount);
    totals = results.map(r => r.deliveredCount);
  } else {
    // Fallback to engagement (opens + clicks)
    observed = results.map(r => r.openedCount + r.clickedCount);
    totals = results.map(r => r.deliveredCount);
  }

  // Perform chi-square test for statistical significance
  const testResult = chiSquareTest(observed, totals);

  // If not statistically significant, don't declare winner
  if (!testResult.isSignificant) {
    return null;
  }

  // Find variant with highest rate
  let winnerIndex = 0;
  let highestRate = observed[0] / Math.max(totals[0], 1);

  for (let i = 1; i < results.length; i++) {
    const rate = observed[i] / Math.max(totals[i], 1);
    if (rate > highestRate) {
      highestRate = rate;
      winnerIndex = i;
    }
  }

  const winner = results[winnerIndex];

  // Calculate lift over control (assume first variant is control)
  const controlRate = observed[0] / Math.max(totals[0], 1);
  const lift = calculateLift(highestRate, controlRate);

  // Declare winner
  await declareWinner(db, campaignId, workspaceId, winner.messageId, criteria);

  return {
    messageId: winner.messageId,
    variantName: winner.variantName,
    pValue: testResult.pValue,
    isSignificant: true,
    lift,
  };
}

/**
 * Evaluate A/B test and return detailed statistical analysis
 * Does NOT declare winner - just returns analysis
 */
export async function evaluateABTest(
  db: Database,
  campaignId: string,
  workspaceId: string,
  criteria: ABTestWinningCriteria = 'open_rate',
  minSampleSize: number = 100
): Promise<{
  hasMinimumSample: boolean;
  sampleValidation: ReturnType<typeof hasMinimumSampleSize>;
  variants: Array<{
    variantName: string;
    messageId: string;
    rate: number;
    count: number;
    total: number;
    confidenceInterval: ReturnType<typeof confidenceInterval>;
  }>;
  chiSquareTest: ReturnType<typeof chiSquareTest> | null;
  recommendedWinner: {
    variantName: string;
    messageId: string;
    lift: number;
  } | null;
}> {
  await updateTestResults(db, campaignId, workspaceId);

  const results = await db
    .select()
    .from(crmAbTestResults)
    .where(
      and(
        eq(crmAbTestResults.campaignId, campaignId),
        eq(crmAbTestResults.workspaceId, workspaceId)
      )
    );

  if (results.length < 2) {
    throw new Error('Need at least 2 variants for A/B testing');
  }

  // Extract data based on criteria
  let observed: number[];
  let totals: number[];

  if (criteria === 'open_rate') {
    observed = results.map(r => r.openedCount);
    totals = results.map(r => r.deliveredCount);
  } else if (criteria === 'click_rate') {
    observed = results.map(r => r.clickedCount);
    totals = results.map(r => r.deliveredCount);
  } else {
    observed = results.map(r => r.openedCount + r.clickedCount);
    totals = results.map(r => r.deliveredCount);
  }

  // Check sample sizes
  const sampleValidation = hasMinimumSampleSize(totals, minSampleSize);

  // Calculate variant details with confidence intervals
  const variants = results.map((result, i) => {
    const rate = totals[i] > 0 ? observed[i] / totals[i] : 0;
    const ci = confidenceInterval(observed[i], totals[i], 0.95);

    return {
      variantName: result.variantName,
      messageId: result.messageId,
      rate,
      count: observed[i],
      total: totals[i],
      confidenceInterval: ci,
    };
  });

  // Perform chi-square test if we have enough data
  let chiSquareResult: ReturnType<typeof chiSquareTest> | null = null;
  let recommendedWinner: {
    variantName: string;
    messageId: string;
    lift: number;
  } | null = null;

  if (sampleValidation.isValid) {
    chiSquareResult = chiSquareTest(observed, totals);

    if (chiSquareResult.isSignificant) {
      // Find best variant
      let bestIndex = 0;
      let bestRate = variants[0].rate;

      for (let i = 1; i < variants.length; i++) {
        if (variants[i].rate > bestRate) {
          bestRate = variants[i].rate;
          bestIndex = i;
        }
      }

      const controlRate = variants[0].rate;
      const lift = calculateLift(bestRate, controlRate);

      recommendedWinner = {
        variantName: variants[bestIndex].variantName,
        messageId: variants[bestIndex].messageId,
        lift,
      };
    }
  }

  return {
    hasMinimumSample: sampleValidation.isValid,
    sampleValidation,
    variants,
    chiSquareTest: chiSquareResult,
    recommendedWinner,
  };
}

export const abTestingService = {
  distributeRecipients,
  updateTestResults,
  declareWinner,
  getTestResults,
  autoDeclareWinner,
  evaluateABTest,
};
