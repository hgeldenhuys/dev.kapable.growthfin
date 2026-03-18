/**
 * Conversation Summary Service
 * Generates and manages conversation summaries with links to commits and files
 */

import { db } from '@agios/db/client';
import {
  conversationSummaries,
  aiMessages,
  aiConversations,
  aiToolInvocations
} from '@agios/db/schema';
import { eq, and, sql, desc, gte, lte, or, ilike, count, asc } from 'drizzle-orm';
import { SummarizationService } from './summarization.service';

export interface ConversationSummary {
  id: string;
  conversationId: string;
  summary: string;
  topics: string[];
  decisions: string[];
  filesDiscussed: string[];
  keywords: string[];
  messageCount: number;
  tokenCount: number;
  durationSeconds: number;
  relatedCommits: string[];
  relatedMemories: string[];
  createdAt: Date;
}

export interface ConversationSearchResult {
  conversation: {
    id: string;
    workspaceId: string;
    createdAt: Date;
    messageCount: number;
  };
  summary: {
    summary: string;
    topics: string[];
    filesDiscussed: string[];
    preview: string;
  };
  relevanceScore: number;
  matchedKeywords: string[];
}

export class ConversationSummaryService {
  /**
   * Generate summary for conversation
   */
  static async generateSummary(
    conversationId: string
  ): Promise<ConversationSummary> {
    // 1. Get all messages
    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(asc(aiMessages.createdAt));

    if (messages.length === 0) {
      throw new Error('No messages to summarize');
    }

    // 2. Get conversation metadata
    const conversation = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, conversationId))
      .limit(1);

    if (!conversation[0]) {
      throw new Error('Conversation not found');
    }

    // 3. Extract files discussed (from tool invocations)
    const toolInvocations = await db
      .select()
      .from(aiToolInvocations)
      .where(eq(aiToolInvocations.conversationId, conversationId));

    const filesDiscussed = new Set<string>();
    for (const inv of toolInvocations) {
      // Extract file paths from different tool types
      if (inv.toolName === 'read_file' && inv.parameters?.path) {
        filesDiscussed.add(inv.parameters.path as string);
      }
      if (inv.toolName === 'write_file' && inv.parameters?.path) {
        filesDiscussed.add(inv.parameters.path as string);
      }
      if (inv.toolName === 'search_files' && inv.result?.files) {
        const resultFiles = inv.result.files as string[];
        for (const file of resultFiles) {
          filesDiscussed.add(file);
        }
      }
    }

    // 4. Generate AI summary
    const summaryResult = await SummarizationService.summarizeConversation(
      conversation[0].workspaceId,
      messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: m.createdAt,
      })),
      1000 // max 1000 chars
    );

    // 5. Calculate duration
    const startTime = messages[0].createdAt.getTime();
    const endTime = messages[messages.length - 1].createdAt.getTime();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    // 6. Calculate total tokens
    const totalTokens = messages.reduce((sum, m) => {
      const metadata = m.metadata as any;
      return sum + (metadata?.tokens || 0);
    }, 0);

    // 7. Store summary (upsert to handle regeneration)
    const existingSummary = await db
      .select()
      .from(conversationSummaries)
      .where(eq(conversationSummaries.conversationId, conversationId))
      .limit(1);

    let summary;
    if (existingSummary.length > 0) {
      // Update existing summary
      summary = await db
        .update(conversationSummaries)
        .set({
          summary: summaryResult.summary,
          topics: summaryResult.topics,
          decisionsMade: summaryResult.decisions || [],
          filesDiscussed: Array.from(filesDiscussed),
          keywords: summaryResult.keywords,
          messageCount: messages.length,
          tokenCount: totalTokens,
          durationSeconds,
        })
        .where(eq(conversationSummaries.conversationId, conversationId))
        .returning();
    } else {
      // Insert new summary
      summary = await db
        .insert(conversationSummaries)
        .values({
          conversationId,
          summary: summaryResult.summary,
          topics: summaryResult.topics,
          decisionsMade: summaryResult.decisions || [],
          filesDiscussed: Array.from(filesDiscussed),
          keywords: summaryResult.keywords,
          messageCount: messages.length,
          tokenCount: totalTokens,
          durationSeconds,
          relatedCommits: [],
          relatedMemories: [],
        })
        .returning();
    }

    return {
      id: summary[0].id,
      conversationId: summary[0].conversationId,
      summary: summary[0].summary,
      topics: summary[0].topics || [],
      decisions: summary[0].decisionsMade || [],
      filesDiscussed: summary[0].filesDiscussed || [],
      keywords: summary[0].keywords || [],
      messageCount: summary[0].messageCount,
      tokenCount: summary[0].tokenCount,
      durationSeconds: summary[0].durationSeconds || 0,
      relatedCommits: summary[0].relatedCommits || [],
      relatedMemories: (summary[0].relatedMemories || []) as string[],
      createdAt: summary[0].createdAt,
    };
  }

  /**
   * Get summary for conversation
   */
  static async getSummary(
    conversationId: string
  ): Promise<ConversationSummary | null> {
    const summary = await db
      .select()
      .from(conversationSummaries)
      .where(eq(conversationSummaries.conversationId, conversationId))
      .limit(1);

    if (summary.length === 0) {
      return null;
    }

    const s = summary[0];
    return {
      id: s.id,
      conversationId: s.conversationId,
      summary: s.summary,
      topics: s.topics || [],
      decisions: s.decisionsMade || [],
      filesDiscussed: s.filesDiscussed || [],
      keywords: s.keywords || [],
      messageCount: s.messageCount,
      tokenCount: s.tokenCount,
      durationSeconds: s.durationSeconds || 0,
      relatedCommits: s.relatedCommits || [],
      relatedMemories: (s.relatedMemories || []) as string[],
      createdAt: s.createdAt,
    };
  }

  /**
   * Update summary
   */
  static async updateSummary(
    conversationId: string,
    updates: Partial<ConversationSummary>
  ): Promise<ConversationSummary> {
    const updated = await db
      .update(conversationSummaries)
      .set(updates)
      .where(eq(conversationSummaries.conversationId, conversationId))
      .returning();

    const s = updated[0];
    return {
      id: s.id,
      conversationId: s.conversationId,
      summary: s.summary,
      topics: s.topics || [],
      decisions: s.decisionsMade || [],
      filesDiscussed: s.filesDiscussed || [],
      keywords: s.keywords || [],
      messageCount: s.messageCount,
      tokenCount: s.tokenCount,
      durationSeconds: s.durationSeconds || 0,
      relatedCommits: s.relatedCommits || [],
      relatedMemories: (s.relatedMemories || []) as string[],
      createdAt: s.createdAt,
    };
  }

  /**
   * Link conversation to commits
   */
  static async linkToCommits(
    conversationId: string,
    commitHashes: string[]
  ): Promise<{ linked: number }> {
    let summary = await this.getSummary(conversationId);

    if (!summary) {
      // Generate summary first
      summary = await this.generateSummary(conversationId);
    }

    // Update related commits (append new ones)
    const existingCommits = summary.relatedCommits || [];
    const newCommits = [...new Set([...existingCommits, ...commitHashes])];

    await db
      .update(conversationSummaries)
      .set({
        relatedCommits: newCommits,
      })
      .where(eq(conversationSummaries.conversationId, conversationId));

    return { linked: commitHashes.length };
  }

  /**
   * Auto-link by time correlation
   * Links conversations to commits based on timestamp proximity and file overlap
   */
  static async autoLinkCommits(
    workspaceId: string,
    commitData: {
      hash: string;
      timestamp: Date;
      author: string;
      message: string;
      files: string[];
    }[]
  ): Promise<{ linked: number }> {
    let linkedCount = 0;

    for (const commit of commitData) {
      // Find conversations active around commit time (±2 hours)
      const timeWindow = 2 * 60 * 60 * 1000; // 2 hours in ms
      const startTime = new Date(commit.timestamp.getTime() - timeWindow);
      const endTime = new Date(commit.timestamp.getTime() + timeWindow);

      const conversations = await db
        .select({ id: aiConversations.id })
        .from(aiConversations)
        .where(
          and(
            eq(aiConversations.workspaceId, workspaceId),
            gte(aiConversations.createdAt, startTime),
            lte(aiConversations.createdAt, endTime)
          )
        );

      // Link to matching conversations
      for (const conv of conversations) {
        // Check if conversation discussed same files
        const summary = await this.getSummary(conv.id);

        if (summary) {
          const commonFiles = commit.files.filter((f) =>
            summary.filesDiscussed.some((df) => df.includes(f) || f.includes(df))
          );

          if (commonFiles.length > 0) {
            await this.linkToCommits(conv.id, [commit.hash]);
            linkedCount++;
          }
        }
      }
    }

    return { linked: linkedCount };
  }

  /**
   * Get commits for conversation
   */
  static async getRelatedCommits(conversationId: string): Promise<string[]> {
    const summary = await this.getSummary(conversationId);
    return summary?.relatedCommits || [];
  }

  /**
   * Get conversations for commit
   */
  static async getConversationsForCommit(
    workspaceId: string,
    commitHash: string
  ): Promise<ConversationSummary[]> {
    const summaries = await db
      .select({
        id: conversationSummaries.id,
        conversationId: conversationSummaries.conversationId,
        summary: conversationSummaries.summary,
        topics: conversationSummaries.topics,
        decisionsMade: conversationSummaries.decisionsMade,
        filesDiscussed: conversationSummaries.filesDiscussed,
        keywords: conversationSummaries.keywords,
        messageCount: conversationSummaries.messageCount,
        tokenCount: conversationSummaries.tokenCount,
        durationSeconds: conversationSummaries.durationSeconds,
        relatedCommits: conversationSummaries.relatedCommits,
        relatedMemories: conversationSummaries.relatedMemories,
        createdAt: conversationSummaries.createdAt,
      })
      .from(conversationSummaries)
      .innerJoin(
        aiConversations,
        eq(conversationSummaries.conversationId, aiConversations.id)
      )
      .where(
        and(
          eq(aiConversations.workspaceId, workspaceId),
          sql`${commitHash} = ANY(${conversationSummaries.relatedCommits})`
        )
      );

    return summaries.map((s) => ({
      id: s.id,
      conversationId: s.conversationId,
      summary: s.summary,
      topics: s.topics || [],
      decisions: s.decisionsMade || [],
      filesDiscussed: s.filesDiscussed || [],
      keywords: s.keywords || [],
      messageCount: s.messageCount,
      tokenCount: s.tokenCount,
      durationSeconds: s.durationSeconds || 0,
      relatedCommits: s.relatedCommits || [],
      relatedMemories: (s.relatedMemories || []) as string[],
      createdAt: s.createdAt,
    }));
  }

  /**
   * Search conversations
   */
  static async search(
    workspaceId: string,
    options: {
      query?: string;
      dateRange?: { start: Date; end: Date };
      files?: string[];
      topics?: string[];
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    conversations: ConversationSearchResult[];
    total: number;
  }> {
    const {
      query,
      dateRange,
      files,
      topics,
      limit = 50,
      offset = 0,
    } = options;

    // Build query
    const conditions = [];

    // Workspace filter
    conditions.push(eq(aiConversations.workspaceId, workspaceId));

    // Date range
    if (dateRange) {
      if (dateRange.start) {
        conditions.push(gte(aiConversations.createdAt, dateRange.start));
      }
      if (dateRange.end) {
        conditions.push(lte(aiConversations.createdAt, dateRange.end));
      }
    }

    // Files filter
    if (files && files.length > 0) {
      conditions.push(
        sql`${conversationSummaries.filesDiscussed} && ${files}::text[]`
      );
    }

    // Topics filter
    if (topics && topics.length > 0) {
      conditions.push(
        sql`${conversationSummaries.topics} && ${topics}::text[]`
      );
    }

    // Text search
    if (query) {
      conditions.push(
        or(
          ilike(conversationSummaries.summary, `%${query}%`),
          sql`${conversationSummaries.keywords} && ARRAY[${query}]::text[]`
        )
      );
    }

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(conversationSummaries)
      .innerJoin(
        aiConversations,
        eq(conversationSummaries.conversationId, aiConversations.id)
      )
      .where(and(...conditions));

    const total = countResult[0].count;

    // Get results with pagination
    const results = await db
      .select({
        conversationId: conversationSummaries.conversationId,
        workspaceId: aiConversations.workspaceId,
        createdAt: aiConversations.createdAt,
        summary: conversationSummaries.summary,
        topics: conversationSummaries.topics,
        filesDiscussed: conversationSummaries.filesDiscussed,
        keywords: conversationSummaries.keywords,
        messageCount: conversationSummaries.messageCount,
      })
      .from(conversationSummaries)
      .innerJoin(
        aiConversations,
        eq(conversationSummaries.conversationId, aiConversations.id)
      )
      .where(and(...conditions))
      .orderBy(desc(aiConversations.createdAt))
      .limit(limit)
      .offset(offset);

    // Format results
    const formattedResults: ConversationSearchResult[] = results.map((r) => {
      // Calculate relevance score
      let relevanceScore = 1.0;
      const matchedKeywords: string[] = [];

      if (query) {
        // Check keyword matches
        for (const keyword of r.keywords || []) {
          if (keyword.toLowerCase().includes(query.toLowerCase())) {
            matchedKeywords.push(keyword);
            relevanceScore += 0.1;
          }
        }

        // Check summary match
        if (r.summary.toLowerCase().includes(query.toLowerCase())) {
          relevanceScore += 0.2;
        }
      }

      return {
        conversation: {
          id: r.conversationId,
          workspaceId: r.workspaceId,
          createdAt: r.createdAt,
          messageCount: r.messageCount,
        },
        summary: {
          summary: r.summary,
          topics: r.topics || [],
          filesDiscussed: r.filesDiscussed || [],
          preview: r.summary.substring(0, 200) + '...',
        },
        relevanceScore,
        matchedKeywords,
      };
    });

    // Sort by relevance if query provided
    if (query) {
      formattedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    return {
      conversations: formattedResults,
      total,
    };
  }
}
