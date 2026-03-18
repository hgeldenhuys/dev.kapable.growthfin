/**
 * AI Voice Calls Schema
 * Tables for tracking AI-powered voice calls (ElevenLabs integration)
 */

import { pgTable, uuid, text, integer, decimal, timestamp, jsonb, boolean, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { crmCalls } from './crm';

// Enums for AI call outcomes and sentiment
export const aiCallOutcomeEnum = pgEnum('ai_call_outcome', [
  'interested',
  'not_interested',
  'callback',
  'voicemail',
  'no_answer',
  'failed',
]);

export const aiCallSentimentEnum = pgEnum('ai_call_sentiment', [
  'positive',
  'neutral',
  'negative',
]);

export const aiCallEventTypeEnum = pgEnum('ai_call_event_type', [
  'user_speech',
  'agent_response',
  'tool_use',
  'conversation_started',
  'conversation_ended',
  'error',
]);

export const aiProviderEnum = pgEnum('ai_provider', [
  'elevenlabs',
  'custom',
]);

// Call direction enum
export const aiCallDirectionEnum = pgEnum('ai_call_direction', [
  'outbound',
  'inbound',
]);

// Main AI calls table
export const crmAiCalls = pgTable('crm_ai_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  callId: uuid('call_id').references(() => crmCalls.id, { onDelete: 'cascade' }),

  // ElevenLabs identifiers
  conversationId: text('conversation_id').notNull(),
  agentId: text('agent_id').notNull(),

  // Call direction (Phase L: Inbound AI Calls)
  direction: text('direction').default('outbound').$type<'outbound' | 'inbound'>(),

  // Caller identification (Phase L: Inbound AI Calls)
  callerIdentified: boolean('caller_identified').default(false),
  identifiedEntityType: text('identified_entity_type').$type<'lead' | 'contact'>(),
  identifiedEntityId: uuid('identified_entity_id'),
  callerPhoneNumber: text('caller_phone_number'),

  // Call outcome and analysis
  callOutcome: text('call_outcome').$type<'interested' | 'not_interested' | 'callback' | 'voicemail' | 'no_answer' | 'failed'>(),
  sentiment: text('sentiment').$type<'positive' | 'neutral' | 'negative'>(),
  keyPoints: jsonb('key_points').$type<string[]>().default([]),

  // AI Analysis
  transcript: text('transcript'),
  analysis: jsonb('analysis').$type<{
    intent?: string;
    objections?: string[];
    nextSteps?: string[];
    leadQuality?: 'hot' | 'warm' | 'cold';
  }>(),

  // Collected data from AI conversation (Phase J)
  collectedData: jsonb('collected_data').$type<{
    interestLevel?: 'high' | 'medium' | 'low' | 'none';
    callbackRequested?: boolean;
    preferredCallbackTime?: string;
    meetingScheduled?: boolean;
    meetingDatetime?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    keyPainPoints?: string[];
    nextSteps?: string;
    objectionsRaised?: string[];
    budgetMentioned?: boolean;
    decisionMaker?: boolean;
    timeline?: string;
    customFields?: Record<string, unknown>;
  }>(),

  // Cost tracking
  audioSeconds: integer('audio_seconds'),
  cost: decimal('cost', { precision: 10, scale: 4 }),

  // Script tracking (Phase M: Training/Feedback)
  scriptId: uuid('script_id'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index('idx_crm_ai_calls_workspace_id').on(table.workspaceId),
  callIdIdx: index('idx_crm_ai_calls_call_id').on(table.callId),
  conversationIdIdx: index('idx_crm_ai_calls_conversation_id').on(table.conversationId),
  createdAtIdx: index('idx_crm_ai_calls_created_at').on(table.createdAt),
  callOutcomeIdx: index('idx_crm_ai_calls_call_outcome').on(table.callOutcome),
  directionIdx: index('idx_crm_ai_calls_direction').on(table.direction),
  callerPhoneIdx: index('idx_crm_ai_calls_caller_phone').on(table.callerPhoneNumber),
  scriptIdIdx: index('idx_crm_ai_calls_script_id').on(table.scriptId),
}));

// AI call events table
export const crmAiCallEvents = pgTable('crm_ai_call_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  aiCallId: uuid('ai_call_id').notNull().references(() => crmAiCalls.id, { onDelete: 'cascade' }),

  eventType: text('event_type').notNull().$type<'user_speech' | 'agent_response' | 'tool_use' | 'conversation_started' | 'conversation_ended' | 'error'>(),
  timestamp: timestamp('timestamp').notNull(),
  content: text('content'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  aiCallIdIdx: index('idx_crm_ai_call_events_ai_call_id').on(table.aiCallId),
  eventTypeIdx: index('idx_crm_ai_call_events_event_type').on(table.eventType),
  timestampIdx: index('idx_crm_ai_call_events_timestamp').on(table.timestamp),
}));

// AI agents configuration table
export const crmAiAgents = pgTable('crm_ai_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),

  // Agent details
  name: text('name').notNull(),
  provider: text('provider').notNull().default('elevenlabs').$type<'elevenlabs' | 'custom'>(),
  agentId: text('agent_id').notNull(),
  phoneNumberId: text('phone_number_id'),

  // Configuration
  firstMessage: text('first_message'),
  voiceSettings: jsonb('voice_settings').$type<{
    voice?: string;
    stability?: number;
    similarity?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  }>(),
  personality: jsonb('personality').$type<{
    traits?: string[];
    tone?: string;
    pace?: string;
  }>(),
  knowledgeBase: jsonb('knowledge_base').$type<{
    companyInfo?: string;
    productInfo?: string;
    customRules?: string[];
  }>(),
  clientTools: jsonb('client_tools').$type<Array<{
    name: string;
    description: string;
    url: string;
    method: string;
    parameters: Record<string, any>;
  }>>(),

  // Settings
  isActive: boolean('is_active').default(true),
  maxCallDuration: integer('max_call_duration').default(600),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index('idx_crm_ai_agents_workspace_id').on(table.workspaceId),
  isActiveIdx: index('idx_crm_ai_agents_is_active').on(table.isActive),
}));

// Script purpose enum
export const aiScriptPurposeEnum = pgEnum('ai_script_purpose', [
  'qualification',     // Qualify leads, gather info
  'sales_pitch',       // Sell product/service
  'demo_booking',      // Book a demo/meeting
  'follow_up',         // Follow up on previous interaction
  'survey',            // Gather feedback
  'appointment_reminder', // Remind about appointments
  'custom',            // Custom purpose
]);

// AI call scripts table
export const crmAiCallScripts = pgTable('crm_ai_call_scripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => crmAiAgents.id, { onDelete: 'set null' }),

  name: text('name').notNull(),
  description: text('description'),

  // Purpose and objective
  purpose: text('purpose').$type<'qualification' | 'sales_pitch' | 'demo_booking' | 'follow_up' | 'survey' | 'appointment_reminder' | 'custom'>().default('custom'),
  objective: text('objective'), // Clear goal: "Book a demo" or "Qualify for enterprise plan"

  // Script content
  opening: text('opening').notNull(), // First message with {{contact_name}} placeholder
  talkingPoints: jsonb('talking_points').$type<string[]>().default([]), // Key points to cover
  objectionHandlers: jsonb('objection_handlers').$type<Record<string, string>>(), // Objection -> Response
  qualifyingQuestions: jsonb('qualifying_questions').$type<string[]>(), // Questions to ask
  closing: text('closing'), // How to end positively

  // End conditions - when should AI end the call
  endConditions: jsonb('end_conditions').$type<{
    success: string[];  // e.g., ["Lead books demo", "Lead agrees to follow-up"]
    failure: string[];  // e.g., ["Lead not interested", "Wrong number"]
    neutral: string[];  // e.g., ["Lead needs to think", "Call back later"]
  }>(),

  // Full system prompt (optional - overrides auto-generated prompt)
  systemPrompt: text('system_prompt'),

  // Voice settings for this script
  voiceStyle: jsonb('voice_style').$type<{
    tone?: 'professional' | 'friendly' | 'casual' | 'formal';
    pace?: 'slow' | 'normal' | 'fast';
    enthusiasm?: 'low' | 'medium' | 'high';
  }>(),

  // Settings
  isActive: boolean('is_active').default(true),
  isDefault: boolean('is_default').default(false), // Default script for workspace
  useCount: integer('use_count').default(0),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }),

  // A/B Testing (Phase M: Training/Feedback)
  parentScriptId: uuid('parent_script_id'), // Reference to parent script for variants
  variantName: text('variant_name'), // 'Control', 'Variant A', 'Variant B', etc.
  isControl: boolean('is_control').default(false),
  variantWeight: integer('variant_weight').default(100), // Weight for random selection (0-100)

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceIdIdx: index('idx_crm_ai_call_scripts_workspace_id').on(table.workspaceId),
  agentIdIdx: index('idx_crm_ai_call_scripts_agent_id').on(table.agentId),
  isActiveIdx: index('idx_crm_ai_call_scripts_is_active').on(table.isActive),
  purposeIdx: index('idx_crm_ai_call_scripts_purpose').on(table.purpose),
  parentScriptIdIdx: index('idx_crm_ai_call_scripts_parent_id').on(table.parentScriptId),
}));

// Relations
export const crmAiCallsRelations = relations(crmAiCalls, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmAiCalls.workspaceId],
    references: [workspaces.id],
  }),
  // TODO: Re-enable when crmCalls table is created
  // call: one(crmCalls, {
  //   fields: [crmAiCalls.callId],
  //   references: [crmCalls.id],
  // }),
  events: many(crmAiCallEvents),
}));

export const crmAiCallEventsRelations = relations(crmAiCallEvents, ({ one }) => ({
  aiCall: one(crmAiCalls, {
    fields: [crmAiCallEvents.aiCallId],
    references: [crmAiCalls.id],
  }),
}));

export const crmAiAgentsRelations = relations(crmAiAgents, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [crmAiAgents.workspaceId],
    references: [workspaces.id],
  }),
  scripts: many(crmAiCallScripts),
}));

export const crmAiCallScriptsRelations = relations(crmAiCallScripts, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [crmAiCallScripts.workspaceId],
    references: [workspaces.id],
  }),
  agent: one(crmAiAgents, {
    fields: [crmAiCallScripts.agentId],
    references: [crmAiAgents.id],
  }),
}));

// Type exports
export type CrmAiCall = typeof crmAiCalls.$inferSelect;
export type NewCrmAiCall = typeof crmAiCalls.$inferInsert;

export type CrmAiCallEvent = typeof crmAiCallEvents.$inferSelect;
export type NewCrmAiCallEvent = typeof crmAiCallEvents.$inferInsert;

export type CrmAiAgent = typeof crmAiAgents.$inferSelect;
export type NewCrmAiAgent = typeof crmAiAgents.$inferInsert;

export type CrmAiCallScript = typeof crmAiCallScripts.$inferSelect;
export type NewCrmAiCallScript = typeof crmAiCallScripts.$inferInsert;

export type AiCallOutcome = 'interested' | 'not_interested' | 'callback' | 'voicemail' | 'no_answer' | 'failed';
export type AiCallSentiment = 'positive' | 'neutral' | 'negative';
export type AiCallEventType = 'user_speech' | 'agent_response' | 'tool_use' | 'conversation_started' | 'conversation_ended' | 'error';
export type AiProvider = 'elevenlabs' | 'custom';
export type AiCallDirection = 'outbound' | 'inbound';
export type AiCallEntityType = 'lead' | 'contact';

// Collected data type for AI conversations (Phase J)
export type AiCallCollectedData = {
  interestLevel?: 'high' | 'medium' | 'low' | 'none';
  callbackRequested?: boolean;
  preferredCallbackTime?: string;
  meetingScheduled?: boolean;
  meetingDatetime?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  keyPainPoints?: string[];
  nextSteps?: string;
  objectionsRaised?: string[];
  budgetMentioned?: boolean;
  decisionMaker?: boolean;
  timeline?: string;
  customFields?: Record<string, unknown>;
};