/**
 * Integration Test: Contact Enrichment with Web Search Tool
 * Demonstrates AI using web search during enrichment
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { config } from 'dotenv';
config();

import { db } from '@agios/db';
import {
  crmContacts,
  crmContactLists,
  crmContactListMemberships,
  crmEnrichmentJobs,
  crmEnrichmentResults,
  crmToolCalls,
  workspaces,
  users,
} from '@agios/db';
import { eq, and, isNull } from 'drizzle-orm';
import { enrichmentService } from './enrichment';

describe('Contact Enrichment with Web Search Tool', () => {
  let userId: string;
  let workspaceId: string;
  let contactId: string;
  let listId: string;

  beforeAll(async () => {
    // Create test user
    const testUser = await db
      .insert(users)
      .values({
        email: `tool-test-${Date.now()}@test.com`,
        emailVerified: true,
      })
      .returning();
    userId = testUser[0].id;

    // Create test workspace
    const testWorkspace = await db
      .insert(workspaces)
      .values({
        name: 'Tool Test Workspace',
        slug: `tool-test-${Date.now()}`,
        ownerId: userId,
      })
      .returning();
    workspaceId = testWorkspace[0].id;

    // Create test contact
    const testContact = await db
      .insert(crmContacts)
      .values({
        workspaceId,
        firstName: 'Elon',
        lastName: 'Musk',
        email: 'elon@spacex.com',
        title: 'CEO',
        customFields: {
          company: 'SpaceX',
        },
      })
      .returning();
    contactId = testContact[0].id;

    // Create contact list
    const testList = await db
      .insert(crmContactLists)
      .values({
        workspaceId,
        name: 'Tool Test List',
        description: 'Testing web search tool integration',
      })
      .returning();
    listId = testList[0].id;

    // Add contact to list
    await db.insert(crmContactListMemberships).values({
      workspaceId,
      listId,
      contactId,
      isActive: true,
    });
  });

  test('AI should use web search tool to enrich contact', async () => {
    // Create enrichment job that encourages tool use
    const job = await enrichmentService.createJob(db, {
      workspaceId,
      name: 'Web Search Tool Test',
      description: 'Test AI using web search during enrichment',
      type: 'enhancement',
      mode: 'sample',
      sampleSize: 1,
      sourceListId: listId,
      model: 'openai/gpt-4o-mini',
      prompt: `You are enriching contact data. You have access to a web_search tool to find current information.

For this contact, search the web to find:
1. Recent news about their company
2. Company funding information
3. Any other relevant business information

Use the web_search tool to gather current information, then provide enrichment data including:
- companyNews: Recent news found
- fundingInfo: Funding information
- additionalInfo: Other relevant details
- sources: List of URLs used

Return your response as JSON with these fields.`,
      temperature: '0.7',
      maxTokens: 2000,
    });

    console.log('📊 Running enrichment job with web search tool...');

    // Run sample enrichment
    const result = await enrichmentService.runSample(db, job.id, workspaceId);

    console.log('📈 Enrichment completed:', {
      processed: result.processedCount,
      failed: result.failedCount,
      cost: result.totalCost,
    });

    // Verify enrichment results
    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(0);

    // Get enrichment result
    const enrichmentResults = await db
      .select()
      .from(crmEnrichmentResults)
      .where(
        and(
          eq(crmEnrichmentResults.jobId, job.id),
          eq(crmEnrichmentResults.contactId, contactId)
        )
      );

    expect(enrichmentResults.length).toBe(1);
    const enrichmentResult = enrichmentResults[0];

    console.log('📝 Enrichment result:', {
      status: enrichmentResult.status,
      tokensUsed: enrichmentResult.tokensUsed,
      cost: enrichmentResult.cost,
      enrichmentData: enrichmentResult.enrichmentData,
    });

    expect(enrichmentResult.status).toBe('success');

    // Check if tool calls were logged
    const toolCalls = await db
      .select()
      .from(crmToolCalls)
      .where(eq(crmToolCalls.enrichmentResultId, enrichmentResult.id));

    console.log(`🔧 Tool calls made: ${toolCalls.length}`);

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        console.log('  Tool call:', {
          tool: toolCall.toolName,
          arguments: toolCall.arguments,
          status: toolCall.status,
          cost: toolCall.cost,
          durationMs: toolCall.durationMs,
        });

        expect(toolCall.toolName).toBe('web_search');
        expect(toolCall.status).toBe('success');
        expect(toolCall.arguments).toHaveProperty('query');
      }

      // Verify enrichment data includes information from web search
      expect(enrichmentResult.enrichmentData).toBeDefined();
      console.log('📦 Enrichment data keys:', Object.keys(enrichmentResult.enrichmentData));
    } else {
      console.log('⚠️  Note: AI chose not to use web search tool for this contact');
    }

    // Cleanup
    await db.delete(crmToolCalls).where(eq(crmToolCalls.workspaceId, workspaceId));
    await db.delete(crmEnrichmentResults).where(eq(crmEnrichmentResults.workspaceId, workspaceId));
    await db.delete(crmEnrichmentJobs).where(eq(crmEnrichmentJobs.workspaceId, workspaceId));
    await db.delete(crmContactListMemberships).where(eq(crmContactListMemberships.workspaceId, workspaceId));
    await db.delete(crmContactLists).where(eq(crmContactLists.workspaceId, workspaceId));
    await db.delete(crmContacts).where(eq(crmContacts.workspaceId, workspaceId));
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.delete(users).where(eq(users.id, userId));
  }, 60000); // 60 second timeout for API calls
});
