/**
 * @kapable/tickets — Ticketing service for Kapable apps.
 *
 * Usage:
 *   import { tickets } from '@kapable/tickets';
 *   await tickets.create({ subject: 'Bug', description: 'Details...' });
 *   await tickets.reportError({ error: new Error('Something broke') });
 */

import { platformFetch, platformGet, platformPut } from '@kapable/internal';
import type { PlatformResponse } from '@kapable/internal';

export type { PlatformResponse };

export interface CreateTicketParams {
  subject: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'technical' | 'billing' | 'feature_request' | 'bug' | 'other';
  tags?: string[];
  appId?: string;
  environment?: string;
}

export interface ReportErrorParams {
  error: Error | string;
  context?: Record<string, unknown>;
  tags?: string[];
  appId?: string;
  environment?: string;
  category?: string;
}

export interface UpdateTicketParams {
  status?: 'open' | 'in_progress' | 'waiting_on_customer' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  tags?: string[];
}

export interface ListTicketFilters {
  status?: string;
  priority?: string;
  appId?: string;
  source?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export interface Ticket {
  id: string;
  org_id: string;
  created_by_email: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  source: string;
  app_id: string | null;
  environment: string | null;
  tags: string[];
  error_stack: string | null;
  error_context: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  comment_count?: number;
  app_name?: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_email: string;
  author_type: string;
  message: string;
  created_at: string;
}

export interface TicketUsage {
  tickets_created: number;
  quota: number;
  remaining: number;
  month: string;
}

export interface ErrorTicketResult {
  ticket: Ticket;
  deduplicated: boolean;
}

export const tickets = {
  async create(
    params: CreateTicketParams,
  ): Promise<PlatformResponse<Ticket>> {
    return platformFetch('/v1/tickets', {
      subject: params.subject,
      description: params.description,
      priority: params.priority,
      category: params.category,
      tags: params.tags,
      appId: params.appId,
      environment: params.environment,
      source: 'sdk',
    });
  },

  async reportError(
    params: ReportErrorParams,
  ): Promise<PlatformResponse<ErrorTicketResult>> {
    const err = params.error;
    const isError = err instanceof Error;
    return platformFetch('/v1/tickets/error', {
      errorMessage: isError ? err.message : String(err),
      errorStack: isError ? err.stack : undefined,
      errorContext: params.context,
      tags: params.tags || ['auto-error'],
      appId: params.appId,
      environment: params.environment,
      category: params.category || 'bug',
    });
  },

  async list(
    filters?: ListTicketFilters,
  ): Promise<PlatformResponse<{ tickets: Ticket[]; total: number }>> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.appId) params.set('app_id', filters.appId);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const qs = params.toString();
    return platformGet(`/v1/tickets${qs ? `?${qs}` : ''}`);
  },

  async get(
    ticketId: string,
  ): Promise<PlatformResponse<Ticket>> {
    return platformGet(`/v1/tickets/${ticketId}`);
  },

  async update(
    ticketId: string,
    updates: UpdateTicketParams,
  ): Promise<PlatformResponse<Ticket>> {
    return platformPut(`/v1/tickets/${ticketId}`, updates as Record<string, unknown>);
  },

  async comment(
    ticketId: string,
    message: string,
  ): Promise<PlatformResponse<TicketComment>> {
    return platformFetch(`/v1/tickets/${ticketId}/comments`, {
      message,
      authorType: 'customer',
    });
  },

  async usage(): Promise<PlatformResponse<TicketUsage>> {
    return platformGet('/v1/tickets/usage');
  },
};
