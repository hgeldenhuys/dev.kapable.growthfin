import { Home, FileText, Folder, Settings, Key, Cpu, Building2, UserCircle, Target, TrendingUp, Calendar, CalendarDays, Megaphone, Volume2, Database, Wand2, List, ListChecks, BarChart3, Phone, Ticket, FlaskConical, BookOpen, Bot, MessageSquare, Eye, GitBranch, Clock, Search, BrainCircuit, Webhook, Layers, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

export interface NavItem {
  to?: string;
  label: string;
  icon?: ReactNode;
  type?: "divider";
  dataTour?: string;
}

/**
 * Build dashboard navigation URLs with workspace context
 */
export function buildDashboardNav(workspaceId: string, path: string) {
  return `/dashboard/${workspaceId}${path}`;
}

/**
 * Dashboard Navigation (CRM & Management)
 * Business-focused navigation for CRM and workspace management
 *
 * NOTE: These are path templates - actual links will be built with workspace context
 * Use buildDashboardNav(workspaceId, path) or use NavLink component with workspaceId
 */
export const dashboardNavPaths = {
  overview: "",
  contacts: "/crm/contacts",
  leads: "/crm/leads",
  opportunities: "/crm/opportunities",
  activities: "/crm/activities",
  campaigns: "/crm/campaigns",
  webhookTest: "/crm/webhook-test",
  research: "/crm/research",
  timeline: "/crm/timeline",
  credentials: "/credentials",
  llmConfigs: "/llm-configs",
};

/**
 * Build dashboard navigation with workspace context
 * TWEAK-005: Split navigation - workspace settings here, user-global in /manage
 */
export function getDashboardNav(workspaceId: string): NavItem[] {
  return [
    // OVERVIEW
    { to: `/dashboard/${workspaceId}`, label: "Dashboard", icon: <Home className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/search`, label: "Search", icon: <Search className="h-4 w-4" /> },

    // PIPELINE — core CRM entities in sales journey order
    { type: "divider", label: "Pipeline" },
    { to: `/dashboard/${workspaceId}/crm/leads`, label: "Leads", icon: <Target className="h-4 w-4" />, dataTour: "nav-leads" },
    { to: `/dashboard/${workspaceId}/crm/contacts`, label: "Contacts", icon: <UserCircle className="h-4 w-4" />, dataTour: "nav-contacts" },
    { to: `/dashboard/${workspaceId}/crm/accounts`, label: "Accounts", icon: <Building2 className="h-4 w-4" />, dataTour: "nav-accounts" },
    { to: `/dashboard/${workspaceId}/crm/opportunities`, label: "Opportunities", icon: <TrendingUp className="h-4 w-4" />, dataTour: "nav-opportunities" },
    { to: `/dashboard/${workspaceId}/crm/activities`, label: "Activities", icon: <Calendar className="h-4 w-4" />, dataTour: "nav-activities" },
    { to: `/dashboard/${workspaceId}/crm/leads/my-queue`, label: "My Queue", icon: <ListChecks className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/calendar`, label: "Calendar", icon: <CalendarDays className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/tickets`, label: "Tickets", icon: <Ticket className="h-4 w-4" />, dataTour: "nav-tickets" },
    { to: `/dashboard/${workspaceId}/crm/timeline`, label: "Timeline", icon: <Clock className="h-4 w-4" /> },

    // ENGAGE — outreach tools
    { type: "divider", label: "Engage" },
    { to: `/dashboard/${workspaceId}/crm/campaigns`, label: "Campaigns", icon: <Megaphone className="h-4 w-4" />, dataTour: "nav-campaigns" },
    { to: `/dashboard/${workspaceId}/crm/ai-calls`, label: "AI Calls", icon: <Phone className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/templates`, label: "Templates", icon: <FileText className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/automation`, label: "Automation", icon: <GitBranch className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/batches`, label: "Batches", icon: <Layers className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/agent`, label: "Agent", icon: <Bot className="h-4 w-4" /> },

    // ANALYZE — intelligence & segmentation
    { type: "divider", label: "Analyze" },
    { to: `/dashboard/${workspaceId}/crm/analytics`, label: "Analytics", icon: <BarChart3 className="h-4 w-4" />, dataTour: "nav-analytics" },
    { to: `/dashboard/${workspaceId}/crm/leads/segments`, label: "Segments", icon: <SlidersHorizontal className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/lists`, label: "Lists", icon: <List className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/enrichment`, label: "Enrichment", icon: <Wand2 className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/research`, label: "Research", icon: <Eye className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/predictions`, label: "Predictions", icon: <BrainCircuit className="h-4 w-4" /> },

    // TEST — sandbox
    { type: "divider", label: "Test" },
    { to: `/dashboard/${workspaceId}/crm/sandbox`, label: "Sandbox", icon: <FlaskConical className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/crm/webhook-test`, label: "Webhook Test", icon: <Webhook className="h-4 w-4" /> },

    // RESOURCES — documentation & help
    { type: "divider", label: "Resources" },
    { to: `/dashboard/${workspaceId}/docs/getting-started`, label: "Getting Started", icon: <BookOpen className="h-4 w-4" /> },
    { to: `/dashboard/${workspaceId}/docs/communications`, label: "Communications Docs", icon: <BookOpen className="h-4 w-4" /> },

    // SETTINGS — bottom of sidebar
    { type: "divider", label: "" },
    { to: `/dashboard/${workspaceId}/settings`, label: "Settings", icon: <Settings className="h-4 w-4" /> },
  ];
}

/**
 * Management Navigation (User-global)
 * TWEAK-005: Created for /manage routes (no workspace context)
 * Note: Settings moved back to workspace-scoped /dashboard/{workspaceId}/settings
 */
export function getManagementNav(): NavItem[] {
  return [
    { to: "/manage", label: "Overview", icon: <Home className="h-4 w-4" /> },
    { type: "divider", label: "Configuration" },
    { to: "/manage/credentials", label: "Credentials", icon: <Key className="h-4 w-4" /> },
    { to: "/manage/llm-configs", label: "LLM Configs", icon: <Cpu className="h-4 w-4" /> },
    { to: "/manage/model-catalog", label: "Model Catalog", icon: <Database className="h-4 w-4" /> },
    { to: "/manage/audio", label: "Audio", icon: <Volume2 className="h-4 w-4" /> },
  ];
}

/**
 * Dashboard Root Navigation (Workspace Selection View)
 * Navigation for /dashboard when no workspace is selected
 */
export function getDashboardRootNav(workspaces: Array<{ id: string; name: string; role?: string }>): NavItem[] {
  const workspaceItems: NavItem[] = workspaces.map(workspace => ({
    to: `/dashboard/${workspace.id}`,
    label: workspace.name,
    icon: <Building2 className="h-4 w-4" />,
  }));

  return [
    { to: "/dashboard", label: "All Workspaces", icon: <Home className="h-4 w-4" /> },
    { type: "divider", label: "Your Workspaces" },
    ...workspaceItems,
  ];
}


export const claudeNav: NavItem[] = [
  { to: "/claude", label: "Overview", icon: <Eye className="h-4 w-4" /> },
  { to: "/claude/sessions", label: "Sessions", icon: <MessageSquare className="h-4 w-4" /> },
  { to: "/claude/agents", label: "Agents", icon: <Bot className="h-4 w-4" /> },
  { to: "/claude/projects", label: "Projects", icon: <Folder className="h-4 w-4" /> },
  { type: "divider", label: "Tools" },
  { to: "/claude/hooks", label: "Hooks", icon: <GitBranch className="h-4 w-4" /> },
  { to: "/claude/todo", label: "Todo", icon: <List className="h-4 w-4" /> },
  { to: "/claude/chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
];
