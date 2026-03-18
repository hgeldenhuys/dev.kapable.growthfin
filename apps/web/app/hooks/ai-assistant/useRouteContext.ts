/**
 * US-AI-012: Route Context Hook
 * Automatically extracts route parameters and location context for AI Assistant
 */

import { useParams, useLocation } from 'react-router';

export interface PageMetadata {
  title: string;
  description: string;
  actions: string[];
}

export interface RouteContext {
  currentRoute: string;
  routeParams: Record<string, string | undefined>;
  additionalContext: {
    pathname: string;
    search: string;
    hash: string;
    pageMetadata: PageMetadata | null;
  };
}

/**
 * Page metadata registry — describes what's on each CRM page and what actions are available.
 * Keys are CRM path suffixes (after /dashboard/{workspaceId}).
 * Use `:id` as a placeholder for dynamic segments.
 */
const PAGE_METADATA: Record<string, PageMetadata> = {
  // Overview
  '': {
    title: 'Dashboard',
    description: 'Workspace overview with key metrics and recent activity',
    actions: ['View summary stats', 'See recent leads', 'Check pipeline value'],
  },
  '/crm/search': {
    title: 'Search',
    description: 'Global search across leads, contacts, accounts, and opportunities',
    actions: ['Search by name, email, or company', 'Filter by entity type'],
  },

  // Pipeline
  '/crm/leads': {
    title: 'Leads',
    description: 'Lead management table with search, filters, and bulk operations',
    actions: ['Create new lead', 'Import leads from CSV/Excel', 'Filter by status/source/assignee', 'Bulk assign/update/delete leads', 'Export leads', 'View lead segments'],
  },
  '/crm/leads/import': {
    title: 'Import Leads',
    description: 'Multi-step CSV/Excel import wizard for bulk-adding leads',
    actions: ['Upload CSV or Excel file', 'Map columns to lead fields', 'Validate data before import', 'Complete import'],
  },
  '/crm/leads/new': {
    title: 'New Lead',
    description: 'Form to create a new lead with contact details and source info',
    actions: ['Fill in lead details', 'Set lead source and status', 'Assign to team member', 'Save lead'],
  },
  '/crm/leads/segments': {
    title: 'Lead Segments',
    description: 'Smart segments for filtering and grouping leads by criteria',
    actions: ['Create new segment', 'Edit segment filters', 'View segment preview', 'Delete segment'],
  },
  '/crm/leads/my-queue': {
    title: 'My Queue',
    description: 'Leads assigned to you, prioritized for action',
    actions: ['View assigned leads', 'Update lead status', 'Add notes', 'Contact lead'],
  },
  '/crm/leads/:id': {
    title: 'Lead Detail',
    description: 'View and edit an individual lead with full activity history',
    actions: ['Edit lead details', 'Add note or activity', 'Change status', 'Convert to contact', 'View timeline'],
  },
  '/crm/contacts': {
    title: 'Contacts',
    description: 'Contact management table with search and filters',
    actions: ['Create new contact', 'Import contacts from CSV/Excel', 'Filter by tags/status', 'Export contacts'],
  },
  '/crm/contacts/import': {
    title: 'Import Contacts',
    description: 'Multi-step CSV/Excel import wizard for contacts',
    actions: ['Upload CSV or Excel file', 'Map columns to contact fields', 'Validate data', 'Complete import'],
  },
  '/crm/contacts/new': {
    title: 'New Contact',
    description: 'Form to create a new contact',
    actions: ['Fill in contact details', 'Link to account', 'Save contact'],
  },
  '/crm/contacts/:id': {
    title: 'Contact Detail',
    description: 'View and edit an individual contact with activity history',
    actions: ['Edit contact details', 'Add note or activity', 'View linked opportunities', 'View timeline'],
  },
  '/crm/accounts': {
    title: 'Accounts',
    description: 'Company account management with linked contacts and opportunities',
    actions: ['Create new account', 'Search accounts', 'View account details'],
  },
  '/crm/accounts/new': {
    title: 'New Account',
    description: 'Form to create a new company account',
    actions: ['Fill in company details', 'Save account'],
  },
  '/crm/opportunities': {
    title: 'Opportunities',
    description: 'Sales pipeline kanban board showing deal stages and values',
    actions: ['Create new opportunity', 'Drag deals between stages', 'Filter by stage/value/owner', 'View pipeline metrics'],
  },
  '/crm/activities': {
    title: 'Activities',
    description: 'Tasks, calls, meetings, and follow-ups',
    actions: ['Create new activity', 'Filter by type (call, meeting, task)', 'Mark activities complete', 'View overdue items'],
  },
  '/crm/tickets': {
    title: 'Tickets',
    description: 'Support tickets and product feedback tracking',
    actions: ['Create new ticket', 'Filter by status/priority', 'Assign tickets', 'View ticket details'],
  },
  '/crm/timeline': {
    title: 'Timeline',
    description: 'Activity timeline feed showing recent actions across the CRM',
    actions: ['View recent activities', 'Filter by entity type', 'Browse history'],
  },

  // Engage
  '/crm/campaigns': {
    title: 'Campaigns',
    description: 'Marketing campaign management with email/SMS outreach',
    actions: ['Create new campaign', 'View campaign analytics', 'Manage campaign audiences', 'Edit campaign content'],
  },
  '/crm/campaigns/new': {
    title: 'New Campaign',
    description: 'Campaign creation wizard with audience selection and content editor',
    actions: ['Select campaign type', 'Choose audience/segment', 'Design content', 'Schedule or send'],
  },
  '/crm/ai-calls': {
    title: 'AI Calls',
    description: 'AI-powered phone call management and call queue',
    actions: ['View call queue', 'Start AI call', 'Review call transcripts', 'Manage call settings'],
  },
  '/crm/templates': {
    title: 'Templates',
    description: 'Email and SMS message templates for campaigns and outreach',
    actions: ['Create new template', 'Edit existing templates', 'Preview template', 'Duplicate template'],
  },
  '/crm/automation': {
    title: 'Automation',
    description: 'Workflow automation rules for lead routing, follow-ups, and notifications',
    actions: ['Create automation rule', 'Enable/disable rules', 'View automation logs'],
  },

  // Analyze
  '/crm/analytics': {
    title: 'Analytics',
    description: 'Reports, charts, and data export for business insights',
    actions: ['View lead/contact analytics', 'Export data as CSV/Excel', 'View conversion metrics', 'Filter by date range'],
  },
  '/crm/lists': {
    title: 'Lists',
    description: 'Custom contact and lead list management',
    actions: ['Create new list', 'Add/remove members', 'Export list', 'Use list in campaigns'],
  },
  '/crm/enrichment': {
    title: 'Enrichment',
    description: 'Data enrichment tools to enhance contact and company information',
    actions: ['Enrich contacts', 'View enrichment results', 'Configure enrichment sources'],
  },
  '/crm/research': {
    title: 'Research',
    description: 'Research sessions and findings for prospect intelligence',
    actions: ['Start new research session', 'View findings', 'Link research to leads/contacts'],
  },
  '/crm/predictions': {
    title: 'Predictions',
    description: 'AI predictions dashboard for lead scoring and conversion likelihood',
    actions: ['View lead scores', 'See conversion predictions', 'Review prediction accuracy'],
  },

  // Test
  '/crm/sandbox': {
    title: 'Sandbox',
    description: 'Testing environment with sample data for safe experimentation',
    actions: ['Toggle sandbox mode', 'Generate test data', 'Test workflows'],
  },

  // Settings
  '/settings': {
    title: 'Settings',
    description: 'Workspace configuration including team, integrations, and preferences',
    actions: ['Manage team members', 'Configure integrations', 'Update workspace settings'],
  },
};

/**
 * Match the current pathname to a page metadata entry.
 * Strips the /dashboard/{workspaceId} prefix first, then tries exact match,
 * then tries patterns with :id placeholders.
 */
function matchPageMetadata(pathname: string): PageMetadata | null {
  // Strip /dashboard/{workspaceId} prefix to get the CRM-relative path
  const match = pathname.match(/^\/dashboard\/[^/]+(\/.*)?$/);
  const crmPath = match ? (match[1] || '') : '';

  // Try exact match first
  if (PAGE_METADATA[crmPath]) {
    return PAGE_METADATA[crmPath];
  }

  // Try matching patterns with :id (replace UUID-like segments with :id)
  const genericPath = crmPath.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id');
  if (PAGE_METADATA[genericPath]) {
    return PAGE_METADATA[genericPath];
  }

  // Try matching with any dynamic segment (non-keyword path segments)
  const segments = crmPath.split('/');
  if (segments.length >= 3) {
    const parentPath = segments.slice(0, -1).join('/');
    const wildcardKey = parentPath + '/:id';
    if (PAGE_METADATA[wildcardKey]) {
      return PAGE_METADATA[wildcardKey];
    }
  }

  return null;
}

/**
 * Hook to extract route context for AI Assistant
 * Provides current route, parameters, and additional context including page metadata
 */
export function useRouteContext(): RouteContext {
  const params = useParams();
  const location = useLocation();

  const pageMetadata = matchPageMetadata(location.pathname);

  return {
    currentRoute: location.pathname,
    routeParams: params,
    additionalContext: {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      pageMetadata,
    },
  };
}
