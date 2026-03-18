/**
 * Getting Started / Onboarding Guide (Workspace-Independent)
 * Step-by-step guide for first-time users of the GrowthFin CRM
 * Shareable link: /docs/getting-started
 */

import { data, type MetaFunction, type LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { DocsHeader } from '~/components/docs/DocsHeader';
import { getTheme } from '~/lib/theme';
import { cn } from '~/lib/utils';
import {
  BookOpen, LogIn, LayoutDashboard, SidebarIcon, Target, UserCircle,
  List, FileText, Megaphone, BarChart3, Bot, Wand2, Settings,
  ChevronRight, Keyboard, HelpCircle,
} from 'lucide-react';

export const meta: MetaFunction = () => {
  return [
    { title: 'Getting Started - GrowthFin CRM' },
    { name: 'description', content: 'Step-by-step onboarding guide for new GrowthFin CRM users' },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const theme = await getTheme(request);
  return data({ theme });
}

function StepCard({ step, title, icon, children }: {
  step: number;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card id={`step-${step}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-lg font-bold shrink-0">
            {step}
          </div>
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-xl">{title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pl-[4.25rem] space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

function Instruction({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <ChevronRight className="h-4 w-4 mt-1 text-primary shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function NavTable({ items }: { items: Array<{ name: string; desc: string }> }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left p-3 font-medium">Menu Item</th>
            <th className="text-left p-3 font-medium">What it does</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-t">
              <td className="p-3 font-medium">{item.name}</td>
              <td className="p-3 text-muted-foreground">{item.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GettingStartedPage() {
  const { theme } = useLoaderData<typeof loader>();

  const steps = [
    'Log In',
    'The Dashboard',
    'Sidebar Navigation',
    'Create Your First Lead',
    'Create Your First Contact',
    'Create a List',
    'Create an Email Template',
    'Create and Send a Campaign',
    'Lead Scoring',
    'AI Agent',
    'Enriching Leads',
    'Settings & Sandbox Mode',
  ];

  return (
    <div className={cn(theme, "bg-background min-h-screen font-sans selection:bg-primary/10")}>
      <DocsHeader theme={theme} />

      <div className="container mx-auto py-12 px-4 max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Getting Started</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Welcome to GrowthFin! This guide walks you through the system step by step.
          </p>
        </div>

        {/* Quick Jump */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jump to a section</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {steps.map((label, i) => (
                <a
                  key={i}
                  href={`#step-${i + 1}`}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors text-sm"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  {label}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Log In */}
        <StepCard step={1} title="Log In" icon={<LogIn className="h-5 w-5 text-muted-foreground" />}>
          <Instruction>Go to <strong>https://growthfin.signaldb.app</strong></Instruction>
          <Instruction>Enter your <strong>email</strong> and <strong>password</strong> (provided by your admin)</Instruction>
          <Instruction>Click <strong>Sign In</strong></Instruction>
          <p className="text-muted-foreground">
            You'll land on the <strong>Workspace Selector</strong> — click on your workspace name to enter the CRM.
          </p>
        </StepCard>

        {/* Step 2: The Dashboard */}
        <StepCard step={2} title="The Dashboard" icon={<LayoutDashboard className="h-5 w-5 text-muted-foreground" />}>
          <p>The dashboard is your home base. It shows:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Quick Actions</p>
              <p className="text-sm text-muted-foreground">Shortcuts to create leads, contacts, opportunities, and activities</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Stats Cards</p>
              <p className="text-sm text-muted-foreground">Counts of your leads, contacts, accounts, and opportunities</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Pipeline Summary</p>
              <p className="text-sm text-muted-foreground">Total and weighted pipeline value in Rands</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">Recent Activities</p>
              <p className="text-sm text-muted-foreground">Your latest tasks, calls, notes, and timeline</p>
            </div>
          </div>
        </StepCard>

        {/* Step 3: Sidebar Navigation */}
        <StepCard step={3} title="Understanding the Sidebar" icon={<SidebarIcon className="h-5 w-5 text-muted-foreground" />}>
          <p className="font-medium mb-2">PIPELINE — your data</p>
          <NavTable items={[
            { name: 'Leads', desc: 'People or companies who might become customers' },
            { name: 'Contacts', desc: 'Confirmed contacts you\'re working with' },
            { name: 'Accounts', desc: 'Companies / organizations' },
            { name: 'Opportunities', desc: 'Deals in your sales pipeline' },
            { name: 'Activities', desc: 'Tasks, calls, and meetings' },
            { name: 'My Queue', desc: 'Leads assigned to you specifically' },
            { name: 'Calendar', desc: 'Calendar view of your activities' },
            { name: 'Tickets', desc: 'Support tickets' },
          ]} />

          <p className="font-medium mb-2 mt-4">ENGAGE — outreach tools</p>
          <NavTable items={[
            { name: 'Campaigns', desc: 'Email and SMS campaigns to reach leads at scale' },
            { name: 'AI Calls', desc: 'AI-powered voice calling' },
            { name: 'Templates', desc: 'Reusable email and SMS message templates' },
            { name: 'Automation', desc: 'Automated workflows' },
            { name: 'Agent', desc: 'AI assistant that answers questions about your CRM data' },
          ]} />

          <p className="font-medium mb-2 mt-4">ANALYZE — insights</p>
          <NavTable items={[
            { name: 'Analytics', desc: 'Reports and charts about your pipeline' },
            { name: 'Lists', desc: 'Organize leads/contacts into named groups' },
            { name: 'Enrichment', desc: 'AI-powered data enrichment for your leads' },
            { name: 'Predictions', desc: 'AI predictions about lead behaviour' },
          ]} />
        </StepCard>

        {/* Step 4: Create First Lead */}
        <StepCard step={4} title="Create Your First Lead" icon={<Target className="h-5 w-5 text-muted-foreground" />}>
          <p>A <strong>lead</strong> is someone who might become a customer.</p>
          <ol className="list-decimal list-inside space-y-2 ml-1">
            <li>Click <strong>Leads</strong> in the sidebar</li>
            <li>Click the <strong>"New Lead"</strong> button (top right)</li>
            <li>Fill in the form:
              <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-muted-foreground">
                <li><strong>First Name</strong> and <strong>Last Name</strong> (required)</li>
                <li><strong>Email</strong> and <strong>Phone</strong> (optional but recommended)</li>
                <li><strong>Company Name</strong> (required)</li>
                <li><strong>Title</strong> — their job title</li>
                <li><strong>Source</strong> — how you found them (Website, Referral, LinkedIn, etc.)</li>
                <li><strong>Status</strong> — starts as "New"</li>
              </ul>
            </li>
            <li>Click <strong>"Create Lead"</strong></li>
          </ol>
          <p className="text-muted-foreground mt-2">
            You'll be taken to the <strong>Lead Detail Page</strong> showing contact info, a lead score card, and activity/enrichment tabs.
          </p>

          <div className="rounded-lg border p-4 bg-muted/30 mt-3">
            <p className="font-medium mb-2">Working with leads</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <span><strong>Edit</strong> — Click "Edit" on the detail page</span>
              <span><strong>Delete</strong> — Three-dot menu (...) then "Delete"</span>
              <span><strong>Search</strong> — Use the search bar on the leads list</span>
              <span><strong>Filter</strong> — Use the Status and Source dropdowns</span>
              <span><strong>Import</strong> — Upload leads from a CSV file</span>
              <span><strong>Export</strong> — Download leads as a CSV</span>
            </div>
          </div>
        </StepCard>

        {/* Step 5: Create First Contact */}
        <StepCard step={5} title="Create Your First Contact" icon={<UserCircle className="h-5 w-5 text-muted-foreground" />}>
          <p>A <strong>contact</strong> is someone you're actively working with (often converted from a lead).</p>
          <ol className="list-decimal list-inside space-y-2 ml-1">
            <li>Click <strong>Contacts</strong> in the sidebar</li>
            <li>Click <strong>"New Contact"</strong></li>
            <li>Fill in: First Name, Last Name, Email, Phone</li>
            <li>Click <strong>"Create"</strong></li>
          </ol>
          <p className="text-muted-foreground">
            Contacts work similarly to leads — you can view, edit, delete, search, import, and export them.
          </p>
        </StepCard>

        {/* Step 6: Create a List */}
        <StepCard step={6} title="Create a List" icon={<List className="h-5 w-5 text-muted-foreground" />}>
          <p><strong>Lists</strong> help you organize leads or contacts into groups (e.g., "Q1 Prospects", "Event Attendees").</p>
          <ol className="list-decimal list-inside space-y-2 ml-1">
            <li>Click <strong>Lists</strong> in the sidebar</li>
            <li>Click <strong>"New List"</strong></li>
            <li>Enter a <strong>name</strong> for the list</li>
            <li>Choose the <strong>entity type</strong> (Lead, Contact, Account, or Opportunity)</li>
            <li>Optionally add a <strong>description</strong></li>
            <li>Click <strong>"Create List"</strong></li>
          </ol>
        </StepCard>

        {/* Step 7: Email Template */}
        <StepCard step={7} title="Create an Email Template" icon={<FileText className="h-5 w-5 text-muted-foreground" />}>
          <p>Before sending campaigns, you'll want reusable <strong>templates</strong>.</p>
          <ol className="list-decimal list-inside space-y-2 ml-1">
            <li>Click <strong>Templates</strong> in the sidebar</li>
            <li>Click <strong>"New Template"</strong></li>
            <li>Choose type: <strong>Email</strong></li>
            <li>Fill in:
              <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-muted-foreground">
                <li><strong>Template Name</strong> — e.g., "Welcome Email"</li>
                <li><strong>Category</strong> — e.g., Marketing, Sales, Follow-up</li>
                <li><strong>Subject Line</strong> — e.g., "Welcome to our newsletter"</li>
                <li><strong>Email Body</strong> — write your message</li>
              </ul>
            </li>
            <li>Click <strong>"Create Template"</strong></li>
          </ol>
          <div className="rounded-lg border p-3 bg-blue-50 dark:bg-blue-950/30 mt-2">
            <p className="text-sm">
              <strong>Tip:</strong> You can use merge fields like <code className="bg-muted px-1 rounded">{"{{firstName}}"}</code> in
              your templates. These get replaced with the actual contact's name when the email is sent.
            </p>
          </div>
        </StepCard>

        {/* Step 8: Campaigns */}
        <StepCard step={8} title="Create and Send a Campaign" icon={<Megaphone className="h-5 w-5 text-muted-foreground" />}>
          <p>A <strong>campaign</strong> sends emails or SMS messages to a group of contacts.</p>
          <ol className="list-decimal list-inside space-y-2 ml-1">
            <li>Click <strong>Campaigns</strong> in the sidebar</li>
            <li>Click <strong>"New Campaign"</strong></li>
            <li>Follow the 3-step wizard:
              <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-muted-foreground">
                <li><strong>Step 1: Details</strong> — Name your campaign, choose type (Email or SMS)</li>
                <li><strong>Step 2: Audience</strong> — Select a contact list</li>
                <li><strong>Step 3: Message</strong> — Choose a template or write a custom message</li>
              </ul>
            </li>
            <li>Review and click <strong>"Create Campaign"</strong></li>
            <li>On the campaign detail page, click <strong>"Activate"</strong> to send</li>
          </ol>
          <div className="rounded-lg border p-3 bg-yellow-50 dark:bg-yellow-950/30 mt-2">
            <p className="text-sm">
              <strong>Important:</strong> If <strong>Sandbox Mode</strong> is ON (shown in the top bar), emails and SMS
              messages are <strong>simulated</strong> — they won't actually be delivered. This is perfect for testing.
            </p>
          </div>
        </StepCard>

        {/* Step 9: Lead Scoring */}
        <StepCard step={9} title="Understanding Lead Scoring" icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}>
          <p>Every lead gets an automatic <strong>score from 0-100</strong> based on three factors:</p>
          <div className="rounded-lg border overflow-hidden mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 font-medium">Factor</th>
                  <th className="text-left p-3 font-medium">Weight</th>
                  <th className="text-left p-3 font-medium">What it measures</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-3 font-medium">Propensity</td>
                  <td className="p-3">40%</td>
                  <td className="p-3 text-muted-foreground">How likely they are to buy (AI signals)</td>
                </tr>
                <tr className="border-t">
                  <td className="p-3 font-medium">Engagement</td>
                  <td className="p-3">30%</td>
                  <td className="p-3 text-muted-foreground">How much they interact with your emails, calls, etc.</td>
                </tr>
                <tr className="border-t">
                  <td className="p-3 font-medium">Fit</td>
                  <td className="p-3">30%</td>
                  <td className="p-3 text-muted-foreground">How well they match your ideal customer profile</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-2">
            Higher scores = hotter leads. Focus your time on leads with scores above 50.
          </p>
        </StepCard>

        {/* Step 10: AI Agent */}
        <StepCard step={10} title="Using the AI Agent" icon={<Bot className="h-5 w-5 text-muted-foreground" />}>
          <p>The <strong>AI Agent</strong> can answer questions about your CRM data in natural language.</p>
          <ol className="list-decimal list-inside space-y-2 ml-1">
            <li>Click <strong>Agent</strong> in the sidebar</li>
            <li>Type a question like:
              <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-muted-foreground">
                <li>"How many leads do I have?"</li>
                <li>"Show me leads from LinkedIn"</li>
                <li>"What's my pipeline value?"</li>
              </ul>
            </li>
            <li>The AI will query your data and respond</li>
          </ol>
          <div className="rounded-lg border p-3 bg-muted/30 mt-2">
            <p className="text-sm">
              <strong>Note:</strong> The AI Agent requires an OpenRouter API key configured in Settings.
              Ask your admin if you don't see responses.
            </p>
          </div>
        </StepCard>

        {/* Step 11: Enrichment */}
        <StepCard step={11} title="Enriching Leads" icon={<Wand2 className="h-5 w-5 text-muted-foreground" />}>
          <p><strong>Enrichment</strong> uses AI to automatically find more information about your leads.</p>
          <ol className="list-decimal list-inside space-y-2 ml-1">
            <li>Open a lead's detail page</li>
            <li>Click the <strong>"Enrich Lead"</strong> button</li>
            <li>The AI will search for additional data (company info, social profiles, etc.)</li>
          </ol>
          <p className="text-muted-foreground">
            You can also enrich leads in bulk from the <strong>Enrichment</strong> page in the sidebar.
          </p>
        </StepCard>

        {/* Step 12: Settings */}
        <StepCard step={12} title="Settings & Sandbox Mode" icon={<Settings className="h-5 w-5 text-muted-foreground" />}>
          <div className="space-y-4">
            <div>
              <p className="font-medium mb-1">Sandbox Mode</p>
              <p className="text-muted-foreground">
                Look for the <strong>"Sandbox Mode: ON"</strong> button in the top header bar. When sandbox is ON,
                emails and SMS messages are <strong>simulated</strong> (not actually sent). You can test everything safely.
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">Settings</p>
              <p className="text-muted-foreground">
                Click <strong>Settings</strong> at the bottom of the sidebar to view workspace info, manage team members,
                configure communication channels, access developer settings, and view audit logs.
              </p>
            </div>
          </div>
        </StepCard>

        {/* Keyboard Shortcuts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Keyboard Shortcuts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 font-medium">Shortcut</th>
                    <th className="text-left p-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="p-3"><kbd className="px-2 py-1 rounded bg-muted text-xs font-mono">Ctrl+K</kbd> / <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono">Cmd+K</kbd></td>
                    <td className="p-3 text-muted-foreground">Open Command Palette — search for anything</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              The Command Palette lets you quickly jump to any page or action without using the mouse.
            </p>
          </CardContent>
        </Card>

        {/* Glossary */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Common Terms</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 font-medium">Term</th>
                    <th className="text-left p-3 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Lead', 'A potential customer — someone you haven\'t qualified yet'],
                    ['Contact', 'A person you\'re actively communicating with'],
                    ['Account', 'A company or organization'],
                    ['Opportunity', 'A potential deal with a Rand value'],
                    ['Activity', 'A task, call, meeting, or email'],
                    ['Campaign', 'A bulk outreach effort (email or SMS)'],
                    ['Template', 'A reusable message format'],
                    ['List', 'A named group of leads or contacts'],
                    ['Enrichment', 'AI-powered research to fill in missing data'],
                    ['Sandbox', 'Test mode where nothing is actually sent'],
                    ['Pipeline', 'Your collection of active deals/opportunities'],
                  ].map(([term, meaning], i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3 font-medium">{term}</td>
                      <td className="p-3 text-muted-foreground">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-lg font-medium text-foreground mb-2">Welcome aboard!</p>
          <p>
            <Link to="/dashboard" className="text-primary underline">Go to your dashboard</Link>
            {' '}to start exploring the CRM.
          </p>
        </div>
      </div>
    </div>
  );
}
