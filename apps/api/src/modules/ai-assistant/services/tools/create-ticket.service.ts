/**
 * Create Ticket AI Tool Service
 * Allows AI assistant to create support tickets and product feedback
 */

import { db } from '@agios/db/client';
import { crmTickets } from '@agios/db';
import { eq, and, isNull, or, ilike } from 'drizzle-orm';

export class CreateTicketError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'CreateTicketError';
  }
}

interface CreateTicketParams {
  title: string;
  description?: string;
  category: 'support' | 'product_feedback' | 'feature_request' | 'bug_report';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  entityType?: 'lead' | 'contact' | 'account';
  entityId?: string;
}

const VALID_CATEGORIES = ['support', 'product_feedback', 'feature_request', 'bug_report'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export class CreateTicketService {
  /**
   * Validate and normalize parameters
   */
  static validateParams(params: any): CreateTicketParams {
    if (!params.title || typeof params.title !== 'string' || params.title.trim().length === 0) {
      throw new CreateTicketError('title is required and must be a non-empty string', 'MISSING_TITLE');
    }

    const category = params.category || 'support';
    if (!VALID_CATEGORIES.includes(category)) {
      throw new CreateTicketError(
        `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
        'INVALID_CATEGORY'
      );
    }

    const priority = params.priority || 'medium';
    if (!VALID_PRIORITIES.includes(priority)) {
      throw new CreateTicketError(
        `priority must be one of: ${VALID_PRIORITIES.join(', ')}`,
        'INVALID_PRIORITY'
      );
    }

    if (params.entityType && !['lead', 'contact', 'account'].includes(params.entityType)) {
      throw new CreateTicketError(
        'entityType must be one of: lead, contact, account',
        'INVALID_ENTITY_TYPE'
      );
    }

    if (params.entityType && !params.entityId) {
      throw new CreateTicketError(
        'entityId is required when entityType is provided',
        'MISSING_ENTITY_ID'
      );
    }

    return {
      title: params.title.trim(),
      description: params.description?.trim(),
      category,
      priority,
      entityType: params.entityType,
      entityId: params.entityId,
    };
  }

  /**
   * Execute ticket creation
   */
  static async execute(
    params: CreateTicketParams,
    workspaceId: string,
    context: { conversationId: string; userId?: string }
  ): Promise<any> {
    // Search for potential duplicates first
    const duplicates = await this.findPotentialDuplicates(workspaceId, params.title);

    // Create the ticket
    const [ticket] = await db
      .insert(crmTickets)
      .values({
        workspaceId,
        title: params.title,
        description: params.description,
        category: params.category,
        priority: params.priority,
        status: 'open',
        entityType: params.entityType,
        entityId: params.entityId,
        source: 'ai_chat',
        aiConversationId: context.conversationId,
        reportedById: context.userId,
        createdBy: context.userId,
      })
      .returning();

    return {
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        source: ticket.source,
        entityType: ticket.entityType,
        entityId: ticket.entityId,
        createdAt: ticket.createdAt,
      },
      potentialDuplicates: duplicates.length > 0
        ? duplicates.map((d: any) => ({
            id: d.id,
            ticketNumber: d.ticketNumber,
            title: d.title,
            status: d.status,
            category: d.category,
          }))
        : undefined,
    };
  }

  /**
   * Search for potential duplicate tickets
   */
  private static async findPotentialDuplicates(workspaceId: string, title: string) {
    // Extract key words from the title (3+ chars) for fuzzy matching
    const words = title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 5);

    if (words.length === 0) return [];

    // Build ILIKE conditions for each significant word
    const titleConditions = words.map((word) => ilike(crmTickets.title, `%${word}%`));

    const results = await db
      .select({
        id: crmTickets.id,
        ticketNumber: crmTickets.ticketNumber,
        title: crmTickets.title,
        status: crmTickets.status,
        category: crmTickets.category,
      })
      .from(crmTickets)
      .where(
        and(
          eq(crmTickets.workspaceId, workspaceId),
          isNull(crmTickets.deletedAt),
          or(
            eq(crmTickets.status, 'open'),
            eq(crmTickets.status, 'in_progress'),
            eq(crmTickets.status, 'waiting')
          ),
          or(...titleConditions)
        )
      )
      .limit(5);

    return results;
  }
}
