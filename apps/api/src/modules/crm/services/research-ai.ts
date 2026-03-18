/**
 * Research AI Service
 * AI-powered research orchestration
 * Plans queries, executes searches, extracts structured findings
 */

import { llmService } from '../../../lib/llm';
import { getBraveSearchProvider } from '../../../lib/providers/brave-search';
import { db } from '@agios/db';
import {
  crmResearchSessions,
  crmResearchQueries,
  crmResearchFindings,
} from '@agios/db/schema';
import { eq } from 'drizzle-orm';

export interface ResearchContext {
  entityType: 'contact' | 'account';
  entityData: any; // Contact or Account data
  objective: string; // What to research
  maxQueries: number;
}

export class ResearchAIService {
  /**
   * Execute research session
   * AI decides what to search, performs searches, extracts findings
   */
  async executeResearch(sessionId: string, context: ResearchContext): Promise<void> {
    // Update session status
    await db
      .update(crmResearchSessions)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(crmResearchSessions.id, sessionId));

    try {
      // Step 1: AI determines what queries to run
      const queries = await this.planQueries(context);

      // Step 2: Execute each query
      for (const queryPlan of queries) {
        await this.executeQuery(sessionId, queryPlan);
      }

      // Step 3: AI analyzes all results and extracts structured findings
      const findings = await this.extractFindings(sessionId, context);

      // Step 4: Save findings
      for (const finding of findings) {
        await this.saveFinding(sessionId, finding);
      }

      // Mark session complete
      await db
        .update(crmResearchSessions)
        .set({
          status: 'completed',
          completedAt: new Date(),
          totalQueries: queries.length,
          totalFindings: findings.length,
        })
        .where(eq(crmResearchSessions.id, sessionId));
    } catch (error) {
      console.error('Research failed:', error);
      await db
        .update(crmResearchSessions)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        })
        .where(eq(crmResearchSessions.id, sessionId));
    }
  }

  /**
   * AI determines what queries to run based on objective and existing data
   */
  private async planQueries(
    context: ResearchContext
  ): Promise<Array<{ query: string; queryType: string }>> {
    const prompt = `You are a research assistant. Your goal: ${context.objective}

Current data we have:
${JSON.stringify(context.entityData, null, 2)}

Generate a list of 3-5 web search queries that would help achieve the research objective.
Return as JSON array: { "queries": [{ "query": "search query text", "queryType": "web_search" }] }`;

    const response = await llmService.complete('research-assistant', [
      { role: 'user', content: prompt },
    ]);

    try {
      const result = JSON.parse(response.content);
      return result.queries || [];
    } catch (error) {
      console.error('Failed to parse LLM response:', response.content);
      return [];
    }
  }

  /**
   * Execute a single search query
   */
  private async executeQuery(
    sessionId: string,
    queryPlan: { query: string; queryType: string }
  ): Promise<void> {
    // Create query record
    const [queryRecord] = await db
      .insert(crmResearchQueries)
      .values({
        sessionId,
        workspaceId: await this.getWorkspaceId(sessionId),
        query: queryPlan.query,
        queryType: queryPlan.queryType,
        status: 'pending',
      })
      .returning();

    try {
      // Perform web search using Brave Search API (with fallback to mock)
      const braveSearch = getBraveSearchProvider();
      const results = await braveSearch.search(queryPlan.query, {
        count: 5,
        freshness: 'month', // Prefer recent results
      });

      // Convert Brave results to expected format for compatibility
      const searchResults = {
        query: queryPlan.query,
        results: results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.description,
          publishedDate: r.publishedDate,
        })),
        totalResults: results.length,
      };

      // AI summarizes results
      const summary = await this.summarizeResults(queryPlan.query, searchResults);

      // Update query with results
      await db
        .update(crmResearchQueries)
        .set({
          status: 'completed',
          results: searchResults as any,
          summary,
          executedAt: new Date(),
        })
        .where(eq(crmResearchQueries.id, queryRecord.id));
    } catch (error) {
      console.error('Query execution failed:', error);
      await db
        .update(crmResearchQueries)
        .set({ status: 'failed' })
        .where(eq(crmResearchQueries.id, queryRecord.id));
    }
  }

  /**
   * AI summarizes search results
   */
  private async summarizeResults(query: string, results: any): Promise<string> {
    const prompt = `Summarize these search results for the query: "${query}"

Results:
${JSON.stringify(
  results.results.map((r: any) => ({
    title: r.title,
    snippet: r.snippet,
  })),
  null,
  2
)}

Provide a 2-3 sentence summary of the key information found.`;

    const response = await llmService.complete('research-assistant', [
      { role: 'user', content: prompt },
    ]);

    return response.content;
  }

  /**
   * AI extracts structured findings from all query results
   */
  private async extractFindings(
    sessionId: string,
    context: ResearchContext
  ): Promise<
    Array<{
      field: string;
      value: string;
      confidence: number;
      reasoning: string;
      sources: string[];
    }>
  > {
    // Get all query results
    const queries = await db.query.crmResearchQueries.findMany({
      where: eq(crmResearchQueries.sessionId, sessionId),
    });

    const allResults = queries.map((q) => ({
      query: q.query,
      summary: q.summary,
      results: q.results,
    }));

    const prompt = `Based on these research results, extract structured data to update the ${context.entityType} profile.

Research objective: ${context.objective}

Current data:
${JSON.stringify(context.entityData, null, 2)}

Research results:
${JSON.stringify(allResults, null, 2)}

Extract specific facts as structured findings. For each finding, provide:
- field: The field name to update (e.g., "company_size", "job_title", "funding_amount")
- value: The extracted value
- confidence: Confidence score 0-100
- reasoning: Why you believe this is accurate
- sources: Array of URLs that support this finding

Return as JSON: { "findings": [...] }`;

    const response = await llmService.complete('research-assistant', [
      { role: 'user', content: prompt },
    ]);

    try {
      const result = JSON.parse(response.content);
      return result.findings || [];
    } catch (error) {
      console.error('Failed to parse findings:', response.content);
      return [];
    }
  }

  /**
   * Save a finding to database
   */
  private async saveFinding(sessionId: string, finding: any): Promise<void> {
    await db.insert(crmResearchFindings).values({
      sessionId,
      workspaceId: await this.getWorkspaceId(sessionId),
      field: finding.field,
      value: finding.value,
      confidence: finding.confidence,
      reasoning: finding.reasoning,
      sources: finding.sources,
      status: finding.confidence >= 80 ? 'approved' : 'pending', // Auto-approve high-confidence
    });
  }

  /**
   * Helper to get workspace ID from session
   */
  private async getWorkspaceId(sessionId: string): Promise<string> {
    const session = await db.query.crmResearchSessions.findFirst({
      where: eq(crmResearchSessions.id, sessionId),
    });
    if (!session) throw new Error('Session not found');
    return session.workspaceId;
  }
}

export const researchAI = new ResearchAIService();
