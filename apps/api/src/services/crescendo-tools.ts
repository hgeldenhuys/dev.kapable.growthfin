/**
 * Crescendo Tools — Platform-Aware Function Calling
 *
 * Declares 7 tools for Gemini function calling and provides an executor
 * that runs them with org-scoped security. Each tool queries real platform
 * data so the AI can answer with facts instead of guessing.
 */

import { sql } from '../lib/db';
import { listOrgDocuments, getOrgDocument } from './org-docs-service';
import { createTicket } from './tickets-service';
import type { FunctionDeclaration } from '@google/genai';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CrescendoOrgContext {
  orgId: string;
  orgSlug: string;
  orgName: string;
  existingApps: Array<{ id: string; name: string; slug: string; framework: string }>;
  billingPlan: string;
  billingLimits: Record<string, unknown>;
}

// ─── Tool Declarations ──────────────────────────────────────────────────────

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'list_org_apps',
    description: 'List all apps in the current organization, including their slug, framework, and status.',
    parameters: {
      type: 'OBJECT' as any,
      properties: {},
    },
  },
  {
    name: 'get_app_details',
    description: 'Get detailed information about a specific app by its slug, including environments and deployment status.',
    parameters: {
      type: 'OBJECT' as any,
      properties: {
        app_slug: { type: 'STRING' as any, description: 'The slug of the app to look up' },
      },
      required: ['app_slug'],
    },
  },
  {
    name: 'search_org_docs',
    description: 'Search the organization\'s documentation. Optionally filter by category (e.g. "getting-started", "api", "deployment").',
    parameters: {
      type: 'OBJECT' as any,
      properties: {
        category: { type: 'STRING' as any, description: 'Optional category to filter docs by' },
      },
    },
  },
  {
    name: 'get_org_doc',
    description: 'Get the full content of a specific documentation page by its slug.',
    parameters: {
      type: 'OBJECT' as any,
      properties: {
        slug: { type: 'STRING' as any, description: 'The slug of the document to retrieve' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'get_billing_info',
    description: 'Get the organization\'s current billing plan, limits (app count, storage, email quota), and usage.',
    parameters: {
      type: 'OBJECT' as any,
      properties: {},
    },
  },
  {
    name: 'create_ticket',
    description: 'Create a support ticket on behalf of the user. Use when they report a bug, ask for help, or need something that requires human attention.',
    parameters: {
      type: 'OBJECT' as any,
      properties: {
        subject: { type: 'STRING' as any, description: 'Short summary of the issue' },
        description: { type: 'STRING' as any, description: 'Detailed description of the issue or request' },
        priority: { type: 'STRING' as any, description: 'Priority level: low, medium, high, urgent. Defaults to medium.' },
        category: { type: 'STRING' as any, description: 'Category: technical, billing, feature_request, bug, other. Defaults to technical.' },
      },
      required: ['subject', 'description'],
    },
  },
  {
    name: 'log_missing_capability',
    description: 'Log when the user asks for something you cannot do and no tool exists for it. This helps the platform team prioritize new features.',
    parameters: {
      type: 'OBJECT' as any,
      properties: {
        capability: { type: 'STRING' as any, description: 'What the user wanted to do that you cannot' },
        context: { type: 'STRING' as any, description: 'Additional context about why this was requested' },
      },
      required: ['capability', 'context'],
    },
  },
];

export function getCrescendoToolDeclarations(): Array<{ functionDeclarations: FunctionDeclaration[] }> {
  return [{ functionDeclarations: toolDeclarations }];
}

// ─── Tool Executor ──────────────────────────────────────────────────────────

export async function executeCrescendoTool(
  toolName: string,
  args: Record<string, unknown>,
  orgContext: CrescendoOrgContext,
): Promise<Record<string, unknown>> {
  try {
    switch (toolName) {
      case 'list_org_apps':
        return await executeListOrgApps(orgContext);
      case 'get_app_details':
        return await executeGetAppDetails(String(args.app_slug || ''), orgContext);
      case 'search_org_docs':
        return await executeSearchOrgDocs(args.category as string | undefined, orgContext);
      case 'get_org_doc':
        return await executeGetOrgDoc(String(args.slug || ''), orgContext);
      case 'get_billing_info':
        return await executeGetBillingInfo(orgContext);
      case 'create_ticket':
        return await executeCreateTicket(args, orgContext);
      case 'log_missing_capability':
        return await executeLogMissingCapability(args, orgContext);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[crescendo-tools] Error executing ${toolName}:`, msg);
    return { error: `Tool execution failed: ${msg}` };
  }
}

// ─── Tool Implementations ───────────────────────────────────────────────────

async function executeListOrgApps(ctx: CrescendoOrgContext): Promise<Record<string, unknown>> {
  const apps = await sql`
    SELECT a.id, a.name, a.slug, a.framework,
           (SELECT COUNT(*) FROM app_environments ae WHERE ae.app_id = a.id) as env_count
    FROM apps a
    WHERE a.org_id = ${ctx.orgId}
    ORDER BY a.name
  `;

  return {
    apps: apps.map(a => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      framework: a.framework,
      environmentCount: Number(a.env_count),
    })),
    total: apps.length,
  };
}

async function executeGetAppDetails(appSlug: string, ctx: CrescendoOrgContext): Promise<Record<string, unknown>> {
  if (!appSlug) return { error: 'app_slug is required' };

  const apps = await sql`
    SELECT a.* FROM apps a
    WHERE a.org_id = ${ctx.orgId} AND (a.slug = ${appSlug} OR a.id = ${appSlug})
    LIMIT 1
  `;

  if (apps.length === 0) {
    return { error: `App "${appSlug}" not found in this organization` };
  }

  const app = apps[0];
  const envs = await sql`
    SELECT env_name, status, deployment_mode, container_name, git_branch, updated_at
    FROM app_environments
    WHERE app_id = ${app.id}
    ORDER BY env_name
  `;

  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    framework: app.framework,
    gitRepo: app.git_repo,
    description: app.description,
    environments: envs.map(e => ({
      name: e.env_name,
      status: e.status,
      deploymentMode: e.deployment_mode,
      gitBranch: e.git_branch,
      updatedAt: e.updated_at,
    })),
  };
}

async function executeSearchOrgDocs(category: string | undefined, ctx: CrescendoOrgContext): Promise<Record<string, unknown>> {
  const docs = await listOrgDocuments(ctx.orgId, category);
  return {
    documents: docs.map(d => ({
      title: d.title,
      slug: d.slug,
      category: d.category,
      updatedAt: d.updated_at,
    })),
    total: docs.length,
  };
}

async function executeGetOrgDoc(slug: string, ctx: CrescendoOrgContext): Promise<Record<string, unknown>> {
  if (!slug) return { error: 'slug is required' };

  const doc = await getOrgDocument(ctx.orgId, slug);
  if (!doc) {
    return { error: `Document "${slug}" not found` };
  }

  return {
    title: doc.title,
    slug: doc.slug,
    category: doc.category,
    content: doc.content,
  };
}

async function executeGetBillingInfo(ctx: CrescendoOrgContext): Promise<Record<string, unknown>> {
  const plans = await sql`
    SELECT bp.name as plan_name, bp.limits, bp.price_monthly, bp.price_yearly
    FROM org_subscriptions os
    JOIN billing_plans bp ON bp.id = os.plan_id
    WHERE os.org_id = ${ctx.orgId}
    LIMIT 1
  `;

  const plan = plans[0];
  const appCount = await sql`SELECT COUNT(*) as count FROM apps WHERE org_id = ${ctx.orgId}`;

  return {
    plan: plan?.plan_name || 'hobbyist',
    limits: plan?.limits || {},
    priceMonthly: plan?.price_monthly,
    priceYearly: plan?.price_yearly,
    currentAppCount: Number(appCount[0]?.count || 0),
  };
}

async function executeCreateTicket(args: Record<string, unknown>, ctx: CrescendoOrgContext): Promise<Record<string, unknown>> {
  const subject = String(args.subject || '');
  const description = String(args.description || '');
  if (!subject || !description) {
    return { error: 'subject and description are required' };
  }

  const ticket = await createTicket(ctx.orgId, {
    email: 'crescendo@signaldb.app',
    subject,
    description,
    priority: String(args.priority || 'medium') as any,
    category: String(args.category || 'technical') as any,
    source: 'console',
    tags: ['crescendo'],
  });

  return {
    ticketId: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    message: 'Support ticket created successfully',
  };
}

async function executeLogMissingCapability(args: Record<string, unknown>, ctx: CrescendoOrgContext): Promise<Record<string, unknown>> {
  const capability = String(args.capability || '');
  const context = String(args.context || '');
  if (!capability) {
    return { error: 'capability is required' };
  }

  const ticket = await createTicket(ctx.orgId, {
    email: 'crescendo@signaldb.app',
    subject: `[Crescendo] Missing capability: ${capability}`,
    description: `A user requested a capability that Crescendo doesn't have yet.\n\n**Capability:** ${capability}\n**Context:** ${context}\n**Org:** ${ctx.orgName} (${ctx.orgSlug})`,
    priority: 'low',
    category: 'feature_request',
    source: 'console',
    tags: ['crescendo', 'crescendo-missing-tool'],
  });

  return {
    ticketId: ticket.id,
    message: `Logged missing capability: "${capability}". The platform team will review this.`,
  };
}
