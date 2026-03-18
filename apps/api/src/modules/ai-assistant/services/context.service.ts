/**
 * Context Service
 * Extract and prepare context for AI assistant
 */

import { db } from '@agios/db/client';
import { users, workspaces, type WorkspaceSettings } from '@agios/db/schema';
import { eq } from 'drizzle-orm';

export interface ContextParams {
  userId: string;
  workspaceId: string;
  currentRoute?: string;
  routeParams?: Record<string, string>;
  additionalContext?: any;
}

export class ContextService {
  /**
   * Build system context for AI assistant
   * Includes user info, workspace info, route context
   */
  static async buildSystemContext(params: ContextParams): Promise<string> {
    const { userId, workspaceId, currentRoute, routeParams, additionalContext } = params;

    // Fetch user information
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Fetch workspace information
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    // Resolve platform name from workspace settings
    const settings = (workspace?.settings || {}) as WorkspaceSettings;
    const platformName = settings.platformName || 'NewLeads';

    // Build system prompt
    const parts: string[] = [
      `You are an AI assistant for ${platformName}, a lead management and CRM platform. You help users manage leads, contacts, accounts, campaigns, and sales opportunities. You can answer questions about the data in the system and help with CRM workflows.`,
      '',
      'You have access to CRM data tools:',
      '- query_crm: Retrieve, count, or summarize leads, contacts, accounts, opportunities, campaigns',
      '- search_crm: Find people and companies by name, email, or company',
      '',
      'You can manage support tickets:',
      '- query_tickets: Search, list, count, or summarize tickets',
      '- create_ticket: Log a new support ticket or product feedback',
      '',
      '## Proactive Error & Issue Handling',
      'When a user mentions ANY error, problem, failure, or frustration (e.g. "I got an error", "import failed", "it\'s not working", "something broke"):',
      '1. Acknowledge the problem and empathise briefly',
      '2. Suggest practical alternatives or workarounds they can try right now',
      '3. Proactively offer to log a ticket — say something like "Would you like me to log a ticket so the team can look into this?"',
      '4. If the user agrees (or if the problem is clearly a bug), create the ticket:',
      '   a. First search existing tickets for duplicates (query_tickets with action="search")',
      '   b. If no duplicate, create a new ticket with category="bug_report" for errors, "support" for general issues',
      '   c. Include the error details, what the user was trying to do, and the current page URL in the description',
      '   d. Confirm the ticket was created and provide the ticket number',
      '',
      'When a user explicitly reports an issue or asks to create a ticket:',
      '1. Search existing tickets to check for duplicates (query_tickets with action="search")',
      '2. If no duplicate, create a new ticket with appropriate category',
      '3. Confirm the ticket was created and provide the ticket number',
      '',
      'When users ask about data, ALWAYS use these tools. Never guess at numbers.',
      'Prefer action="summary" for broad questions, "count" for specific counts, "list" for details.',
      '',
    ];

    // Add user context
    if (user) {
      parts.push(`User: ${user.name || user.email}`);
      parts.push(`Email: ${user.email}`);
    }

    // Add workspace context
    if (workspace) {
      parts.push(`Workspace: ${workspace.name}`);
    }

    // Build the workspace base URL for navigation links
    const baseUrl = `/dashboard/${workspaceId}`;

    // Add navigation map so the AI can construct links
    parts.push('');
    parts.push('## Navigation & URLs');
    parts.push(`Base URL: ${baseUrl}`);
    parts.push('When suggesting pages or features, ALWAYS render them as clickable markdown links using the full path.');
    parts.push('');
    parts.push('Available pages:');
    parts.push(`- [Dashboard](${baseUrl}) — Workspace overview with key metrics`);
    parts.push(`- [Search](${baseUrl}/crm/search) — Global search across all entities`);
    parts.push(`- [Leads](${baseUrl}/crm/leads) — Lead management, search, filter, bulk ops`);
    parts.push(`- [Import Leads](${baseUrl}/crm/leads/import) — CSV/Excel import wizard`);
    parts.push(`- [New Lead](${baseUrl}/crm/leads/new) — Create a new lead`);
    parts.push(`- [Lead Segments](${baseUrl}/crm/leads/segments) — Smart segments based on filters`);
    parts.push(`- [My Queue](${baseUrl}/crm/leads/my-queue) — Leads assigned to the current user`);
    parts.push(`- [Contacts](${baseUrl}/crm/contacts) — Contact management`);
    parts.push(`- [Import Contacts](${baseUrl}/crm/contacts/import) — CSV/Excel contact import`);
    parts.push(`- [New Contact](${baseUrl}/crm/contacts/new) — Create a new contact`);
    parts.push(`- [Accounts](${baseUrl}/crm/accounts) — Company account management`);
    parts.push(`- [New Account](${baseUrl}/crm/accounts/new) — Create a new account`);
    parts.push(`- [Opportunities](${baseUrl}/crm/opportunities) — Sales pipeline kanban board`);
    parts.push(`- [Activities](${baseUrl}/crm/activities) — Tasks, calls, meetings, follow-ups`);
    parts.push(`- [Tickets](${baseUrl}/crm/tickets) — Support tickets and feedback`);
    parts.push(`- [Timeline](${baseUrl}/crm/timeline) — Activity timeline feed`);
    parts.push(`- [Campaigns](${baseUrl}/crm/campaigns) — Marketing campaign management`);
    parts.push(`- [New Campaign](${baseUrl}/crm/campaigns/new) — Create a new campaign`);
    parts.push(`- [AI Calls](${baseUrl}/crm/ai-calls) — AI-powered phone calls`);
    parts.push(`- [Templates](${baseUrl}/crm/templates) — Email & SMS templates`);
    parts.push(`- [Automation](${baseUrl}/crm/automation) — Workflow automation rules`);
    parts.push(`- [Analytics](${baseUrl}/crm/analytics) — Reports, charts, data export`);
    parts.push(`- [Lists](${baseUrl}/crm/lists) — Contact/lead list management`);
    parts.push(`- [Enrichment](${baseUrl}/crm/enrichment) — Data enrichment tools`);
    parts.push(`- [Research](${baseUrl}/crm/research) — Research sessions & findings`);
    parts.push(`- [Predictions](${baseUrl}/crm/predictions) — AI predictions dashboard`);
    parts.push(`- [Sandbox](${baseUrl}/crm/sandbox) — Testing environment`);
    parts.push(`- [Settings](${baseUrl}/settings) — Workspace configuration`);

    // Add route context if available
    if (currentRoute) {
      parts.push('');
      parts.push('## Current Page');
      parts.push(`URL: ${currentRoute}`);

      // Add route parameters if available
      if (routeParams && Object.keys(routeParams).length > 0) {
        parts.push('Route Parameters:');
        for (const [key, value] of Object.entries(routeParams)) {
          parts.push(`  - ${key}: ${value}`);
        }
      }

      // Add page metadata from frontend if provided
      const pageMetadata = additionalContext?.pageMetadata;
      if (pageMetadata) {
        parts.push(`Title: ${pageMetadata.title}`);
        parts.push(`Description: ${pageMetadata.description}`);
        if (pageMetadata.actions?.length) {
          parts.push('Available actions on this page:');
          for (const action of pageMetadata.actions) {
            parts.push(`  - ${action}`);
          }
        }
      }

      // Add page-specific hint for CRM tool usage
      const pageHint = this.getPageHint(currentRoute, routeParams);
      if (pageHint) {
        parts.push(`Tool Hint: ${pageHint}`);
      }
    }

    // Lead Scoring knowledge
    parts.push('');
    parts.push('## Lead Scoring System');
    parts.push('Every lead has a **Composite Score** (0-100) derived from three weighted dimensions:');
    parts.push('');
    parts.push('| Dimension | Default Weight | What It Measures |');
    parts.push('|-----------|---------------|------------------|');
    parts.push('| Propensity | 40% | Likelihood to buy — sourced from `propensity_score` on the lead record |');
    parts.push('| Engagement | 30% | Recent activity level — calculated from activities in the last 30 days |');
    parts.push('| Fit | 30% | How well the lead matches the Ideal Customer Profile (ICP) |');
    parts.push('');
    parts.push('**Engagement points** by activity type: email open (5), email click (10), call (12), website visit (15), form submit (18), meeting (20). Capped at 100.');
    parts.push('');
    parts.push('**Fit scoring** evaluates: company size, industry match, revenue range, geography, and contact role against the ICP.');
    parts.push('');
    parts.push('**Score tiers:**');
    parts.push('- 80-100 = Hot Lead (critical priority) — schedule demo, assign senior rep');
    parts.push('- 60-79 = Warm Lead (high priority) — nurture with content, invite to events');
    parts.push('- 40-59 = Qualified Lead (medium priority) — continue qualifying');
    parts.push('- 20-39 = Cold Lead (low priority) — long-term nurture');
    parts.push('- 0-19 = Unqualified (minimal priority) — re-qualify or disqualify');
    parts.push('');
    parts.push('Workspace admins can customize scoring model weights in Settings. Score history is tracked over time for trend analysis.');
    parts.push('');

    // Onboarding / UI guide capabilities
    parts.push('');
    parts.push('You are also an onboarding assistant. When users ask where something is or how to do something, use the highlight_element or run_tour tools to visually guide them on the page.');
    parts.push('');
    parts.push('Available UI elements you can highlight:');
    parts.push('- [data-tour="nav-leads"]          → Leads section in the left sidebar');
    parts.push('- [data-tour="nav-contacts"]       → Contacts section in the left sidebar');
    parts.push('- [data-tour="nav-accounts"]       → Accounts section in the left sidebar');
    parts.push('- [data-tour="nav-opportunities"]  → Pipeline/Opportunities in the left sidebar');
    parts.push('- [data-tour="nav-activities"]      → Activities section in the left sidebar');
    parts.push('- [data-tour="nav-campaigns"]       → Campaigns section in the left sidebar');
    parts.push('- [data-tour="nav-tickets"]         → Tickets section in the left sidebar');
    parts.push('- [data-tour="nav-analytics"]       → Analytics section in the left sidebar');
    parts.push('- [data-tour="leads-table"]         → The main leads table');
    parts.push('- [data-tour="new-lead-button"]     → The button to create a new lead');
    parts.push('- [data-tour="lead-search"]         → The search/filter field for leads');
    parts.push('- [data-tour="contacts-table"]      → The main contacts table');
    parts.push('- [data-tour="new-contact-button"]  → The button to create a new contact');
    parts.push('- [data-tour="pipeline-board"]      → The opportunities/pipeline view');
    parts.push('- [data-tour="activities-list"]     → The activities task list');
    parts.push('- [data-tour="call-list"]           → Today\'s prioritised call queue');
    parts.push('');
    parts.push('Always highlight elements when guiding users. For "show me around" requests, use run_tour with 3-5 steps covering the most important sidebar navigation items.');
    parts.push('Only highlight elements that exist on the current page. Sidebar nav items (nav-*) are always visible.');

    // Add behavioral guidelines
    parts.push('');
    parts.push('Guidelines:');
    parts.push('- Provide helpful, contextual assistance based on where the user is in the application');
    parts.push('- For business users, provide clear non-technical explanations');
    parts.push('- For technical questions about code/APIs, provide detailed technical information');
    parts.push('- Be concise and actionable');
    parts.push('- If you need more context to answer accurately, ask clarifying questions');

    return parts.join('\n');
  }

  /**
   * Get a page-specific hint to guide CRM tool usage based on the current route
   */
  static getPageHint(route?: string, _params?: Record<string, string>): string | null {
    if (!route) return null;

    // Match CRM entity pages: /crm/leads, /crm/leads/:id, /crm/contacts/:id, etc.
    const crmMatch = route.match(/\/crm\/(leads|contacts|accounts|opportunities)(?:\/([a-f0-9-]+))?/);
    if (crmMatch) {
      const entity = crmMatch[1];
      const entityId = crmMatch[2];
      if (entityId && entity) {
        return `User is viewing a specific ${entity.slice(0, -1)} (ID: ${entityId}). Use query_crm with action="get_by_id" to fetch details.`;
      }
      if (entity) {
        return `User is on the ${entity} list page. Use query_crm with entity="${entity}" and action="summary" for an overview.`;
      }
    }

    // Match campaign pages
    const campaignMatch = route.match(/\/campaigns(?:\/([a-f0-9-]+))?/);
    if (campaignMatch) {
      const campaignId = campaignMatch[1];
      if (campaignId) {
        return `User is viewing campaign ${campaignId}. Use query_crm with entity="campaigns" and action="get_by_id" to get details.`;
      }
      return `User is on the campaigns page. Use query_crm with entity="campaigns" and action="summary" for an overview.`;
    }

    // Tickets page
    const ticketMatch = route.match(/\/crm\/tickets(?:\/([a-f0-9-]+))?/);
    if (ticketMatch) {
      const ticketId = ticketMatch[1];
      if (ticketId) {
        return `User is viewing ticket ${ticketId}. Use query_tickets with action="get_by_id" to fetch details.`;
      }
      return 'User is on the tickets page. Use query_tickets with action="summary" for an overview of open tickets.';
    }

    // Dashboard page
    if (route.includes('/dashboard') && !route.includes('/settings')) {
      return 'User is on the dashboard. Use query_crm with action="summary" for multiple entities to give an overview.';
    }

    return null;
  }

  /**
   * Extract route context from a route path
   * Returns a human-readable description
   */
  static describeRoute(route: string): string {
    // Common route patterns
    const routeDescriptions: Record<string, string> = {
      '/dashboard': 'Dashboard - Overview of workspace activity',
      '/crm/contacts': 'CRM Contacts - Managing customer contacts',
      '/crm/leads': 'CRM Leads - Lead management and tracking',
      '/crm/opportunities': 'CRM Opportunities - Sales opportunity pipeline',
      '/crm/accounts': 'CRM Accounts - Company account management',
      '/crm/tickets': 'Support Tickets - Issue tracking and product feedback',
      '/campaigns': 'Marketing Campaigns - Campaign management',
      '/analytics': 'Analytics - Business insights and reports',
      '/settings': 'Settings - Workspace configuration',
      '/ai': 'AI Assistant - Current conversation',
    };

    // Try exact match first
    if (routeDescriptions[route]) {
      return routeDescriptions[route];
    }

    // Try prefix match
    for (const [prefix, description] of Object.entries(routeDescriptions)) {
      if (route.startsWith(prefix)) {
        return description;
      }
    }

    // Fallback
    return route;
  }

  /**
   * Format context object for storage
   */
  static formatContext(params: Partial<ContextParams>): Record<string, any> {
    return {
      currentRoute: params.currentRoute,
      routeParams: params.routeParams,
      additionalContext: params.additionalContext,
      timestamp: new Date().toISOString(),
    };
  }
}
