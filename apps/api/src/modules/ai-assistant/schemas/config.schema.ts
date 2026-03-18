/**
 * Configuration Validation Schemas
 * Zod schemas for AI configuration validation
 */

import { t } from 'elysia';

export const AIConfigSchema = t.Object({
  model: t.String({ minLength: 1, maxLength: 100 }),
  maxTokens: t.Number({ minimum: 1, maximum: 100000 }),
  temperature: t.Number({ minimum: 0, maximum: 2 }),
  apiKeyEncrypted: t.Optional(t.String()),
});

export const UpdateAIConfigSchema = t.Object({
  model: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  maxTokens: t.Optional(t.Number({ minimum: 1, maximum: 100000 })),
  temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
  apiKeyEncrypted: t.Optional(t.String()),
});
