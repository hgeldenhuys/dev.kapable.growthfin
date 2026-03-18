/**
 * Crescendo AI Conversation Service
 *
 * Drives the conversational app builder:
 * - Asks clarifying questions to refine a vague idea into a buildable spec
 * - Extracts structured spec from AI responses
 * - Detects when a spec is ready for building
 * - Skips ideation if user provides a detailed PRD
 */

import { chatComplete, chatCompleteMultiTurn, type ChatMessage } from './ai-chat-service';
import { generatePlatformServicesCatalog } from './platform-services-catalog';
import { getCrescendoToolDeclarations, executeCrescendoTool } from './crescendo-tools';
import type { Part } from '@google/genai';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CrescendoSpec {
  appName: string;
  slug: string;
  description: string;
  entities: string[];
  routes: string[];
  roles: string[];
  features: string[];
  framework?: string;
  authEnabled?: boolean;
  databaseEnabled?: boolean;
  prd?: string;
}

export interface CrescendoOrgContext {
  orgId: string;
  orgSlug: string;
  orgName: string;
  existingApps: Array<{ id: string; name: string; slug: string; framework: string }>;
  billingPlan: string;
  billingLimits: Record<string, unknown>;
}

export interface CrescendoReplyResult {
  reply: string;
  spec?: CrescendoSpec;
  specReady: boolean;
  error?: string;
}

// ─── System Prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(orgContext: CrescendoOrgContext, isFeatureMode: boolean): string {
  const platformCatalog = generatePlatformServicesCatalog();

  const basePrompt = `You are Crescendo, SignalDB's conversational app builder. You help users go from a vague idea to a running web application.

## Your Role
${isFeatureMode
  ? `The user wants to add a feature to an existing app. Help them define what the feature does, what UI/routes are needed, and any data model changes.`
  : `Help the user define their app idea clearly enough to build it. Ask 1-3 clarifying questions at a time until you have enough detail.`
}

## Conversation Style
- Be concise and friendly. No fluff.
- Ask focused questions: what does the app do, who uses it, what are the core entities/data, what are the key screens/routes.
- When the user's answers are sufficient, output a structured spec block.
- If the user pastes a detailed PRD (>500 chars with clear structure like headers, entities, routes), skip questions and extract the spec immediately.
- If the user says "just build it" or similar, extract the best spec you can from what you have.

## Platform Services
Recommend these when relevant (they're already available — no extra setup):
${platformCatalog}

## Spec Output Format
When you have enough information, output a fenced code block with the spec:

\`\`\`spec
{
  "appName": "Task Manager",
  "slug": "task-manager",
  "description": "A kanban-style task management app with drag-and-drop boards",
  "entities": ["boards", "columns", "tasks", "labels"],
  "routes": ["/", "/board/:id", "/settings"],
  "roles": ["owner", "member"],
  "features": ["Kanban boards with drag-and-drop", "Task labels and due dates", "Member invites"],
  "framework": "react-router",
  "authEnabled": true,
  "databaseEnabled": true
}
\`\`\`

Rules for the spec:
- "slug" must be lowercase, alphanumeric with hyphens, max 30 chars
- "framework" defaults to "react-router" unless user specifies otherwise
- "authEnabled" defaults to true unless explicitly not needed
- "databaseEnabled" defaults to true unless the app needs no persistence
- Include a "prd" field with a full PRD markdown string if the user provided one or you can generate one from the conversation

## Important
- ALWAYS include the spec block in your response when the spec is ready — don't just describe it
- The spec block must be valid JSON inside the \`\`\`spec fence
- After outputting the spec, briefly explain what you'll build and ask the user to confirm
- Organization slug: "${orgContext.orgSlug}"

## Your Organization Context
- Organization: "${orgContext.orgName}" (${orgContext.orgSlug})
- Billing plan: ${orgContext.billingPlan}
- Existing apps: ${orgContext.existingApps.length > 0
    ? orgContext.existingApps.map(a => `${a.name} (${a.slug}, ${a.framework})`).join(', ')
    : 'None yet — this will be the first!'}

## Available Tools
You have tools to look up org documentation, list apps, check billing info,
and create support tickets. Use them when you need real data — don't guess.

## Security Rules (CRITICAL)
- You operate ONLY within org "${orgContext.orgSlug}". Never access other orgs.
- Never expose internal IDs, database schemas, or infrastructure details.
- If asked to perform an action you cannot do (delete apps, change billing,
  modify infrastructure), politely decline and use log_missing_capability.
- Never execute arbitrary code or SQL. Your tools are the only actions available.

## Ticket Logging
If the user asks for something you can't do and no tool exists for it, use
log_missing_capability to record the request. This helps prioritize new features.`;

  return basePrompt;
}

// ─── Main Conversation Function ─────────────────────────────────────────────

export async function generateCrescendoReply(
  messages: ChatMessage[],
  orgContext: CrescendoOrgContext,
  isFeatureMode: boolean = false,
): Promise<CrescendoReplyResult> {
  const systemPrompt = buildSystemPrompt(orgContext, isFeatureMode);
  const tools = getCrescendoToolDeclarations();
  const chatContext = { orgId: orgContext.orgId };

  // Build initial contents for multi-turn tracking
  const contents: Array<{ role: string; parts: Part[] }> = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  // First call with tools
  let result = await chatComplete(
    { messages, systemPrompt, maxTokens: 4096, temperature: 0.7, tools },
    chatContext,
  );

  if (!result.success) {
    return { reply: '', specReady: false, error: result.error || 'Failed to generate AI reply' };
  }

  // Tool call loop — max 5 iterations
  let iterations = 0;
  while (result.functionCalls?.length && iterations < 5) {
    iterations++;

    // Add model's raw parts to contents (preserves thought_signature)
    const modelParts = result.rawModelParts || result.functionCalls.map(fc => ({
      functionCall: { name: fc.name!, args: fc.args || {} },
    }));
    contents.push({ role: 'model', parts: modelParts });

    // Execute each tool
    const functionResults: Array<{ id: string; name: string; response: Record<string, unknown> }> = [];
    for (const call of result.functionCalls) {
      const toolResult = await executeCrescendoTool(call.name!, call.args || {}, orgContext);
      functionResults.push({
        id: call.id || call.name!,
        name: call.name!,
        response: toolResult,
      });
    }

    // Send results back to model
    result = await chatCompleteMultiTurn(
      { messages, systemPrompt, maxTokens: 4096, temperature: 0.7, tools, previousContents: contents, functionResults },
      chatContext,
    );

    if (!result.success) {
      return { reply: '', specReady: false, error: result.error || 'Tool call continuation failed' };
    }
  }

  if (!result.response) {
    return { reply: '', specReady: false, error: 'Empty response from AI after tool calls' };
  }

  const reply = result.response;
  const spec = extractSpec(reply);
  const specReady = spec !== null && isSpecReady(spec);

  return {
    reply,
    spec: spec || undefined,
    specReady,
  };
}

// ─── Spec Extraction ────────────────────────────────────────────────────────

export function extractSpec(aiResponse: string): CrescendoSpec | null {
  // Look for ```spec { ... } ``` block
  const specMatch = aiResponse.match(/```spec\s*\n([\s\S]*?)\n```/);
  if (!specMatch) return null;

  try {
    const parsed = JSON.parse(specMatch[1].trim());

    // Validate required fields
    if (!parsed.appName || !parsed.slug) return null;

    return {
      appName: String(parsed.appName),
      slug: String(parsed.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30),
      description: String(parsed.description || ''),
      entities: Array.isArray(parsed.entities) ? parsed.entities.map(String) : [],
      routes: Array.isArray(parsed.routes) ? parsed.routes.map(String) : [],
      roles: Array.isArray(parsed.roles) ? parsed.roles.map(String) : ['owner', 'member'],
      features: Array.isArray(parsed.features) ? parsed.features.map(String) : [],
      framework: parsed.framework || 'react-router',
      authEnabled: parsed.authEnabled !== false,
      databaseEnabled: parsed.databaseEnabled !== false,
      prd: parsed.prd || undefined,
    };
  } catch {
    // JSON parse failed — try to be lenient
    return null;
  }
}

export function isSpecReady(spec: CrescendoSpec): boolean {
  return !!(
    spec.appName &&
    spec.slug &&
    spec.description &&
    spec.entities.length > 0 &&
    spec.routes.length > 0
  );
}
