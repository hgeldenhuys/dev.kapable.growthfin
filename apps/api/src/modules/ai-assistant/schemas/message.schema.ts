/**
 * Message Validation Schemas
 * Zod schemas for AI message validation
 */

import { t } from 'elysia';

export const RouteContextSchema = t.Object({
  currentRoute: t.String(),
  routeParams: t.Record(t.String(), t.String()),
  userId: t.String(),
  workspaceId: t.String(),
  additionalContext: t.Optional(t.Any()),
});

export const SendMessageSchema = t.Object({
  message: t.String({ minLength: 1, maxLength: 10000 }),
  context: RouteContextSchema,
});

export const MessageResponseSchema = t.Object({
  id: t.String(),
  conversationId: t.String(),
  role: t.Literal('assistant'),
  content: t.String(),
  createdAt: t.String(),
  model: t.String(),
  tokenUsage: t.Optional(
    t.Object({
      input: t.Number(),
      output: t.Number(),
      total: t.Number(),
    })
  ),
});
