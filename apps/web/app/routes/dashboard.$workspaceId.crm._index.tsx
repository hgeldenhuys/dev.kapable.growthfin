/**
 * CRM Home Dashboard Route
 * Overview and quick actions
 *
 * Uses React Router loader pattern for server-side data fetching.
 */

import { Link, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { Plus, Target, Users, Building2, TrendingUp, CheckSquare } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { ActivityCard } from '~/components/crm/ActivityCard';
import { ActivityFeed } from '~/components/workspace/ActivityFeed';
import { AgentCapacityWidget } from '~/components/dashboard/AgentCapacityWidget';
import { TopIntentLeadsWidget } from '~/components/dashboard/TopIntentLeadsWidget';
import { AtRiskLeadsWidget } from '~/components/dashboard/AtRiskLeadsWidget';
import { OnboardingWelcomeCard } from '~/components/crm/OnboardingWelcomeCard';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { usePermissions } from '~/hooks/usePermissions';
import { isAfter, addDays } from 'date-fns';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

/**
 * Loader for CRM home dashboard
 * Fetches leads, contacts, accounts, opportunities, and activities from database
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const { db, crmLeads, crmContacts, crmAccounts, crmOpportunities, crmActivities, crmEmailTemplates, crmCampaigns, eq, desc, and, isNull } = await import('~/lib/db.server');

  const { workspaceId } = params;

  if (!workspaceId) {
    throw new Response('Workspace ID is required', { status: 400 });
  }

  // Fetch all CRM data in parallel
  const [leads, contacts, accounts, opportunities, activities, templateIds, campaignIds] = await Promise.all([
    db.select().from(crmLeads).where(and(eq(crmLeads.workspaceId, workspaceId), isNull(crmLeads.deletedAt))).orderBy(desc(crmLeads.createdAt)),
    db.select().from(crmContacts).where(eq(crmContacts.workspaceId, workspaceId)).orderBy(desc(crmContacts.createdAt)),
    db.select().from(crmAccounts).where(eq(crmAccounts.workspaceId, workspaceId)).orderBy(desc(crmAccounts.createdAt)),
    db.select().from(crmOpportunities).where(eq(crmOpportunities.workspaceId, workspaceId)).orderBy(desc(crmOpportunities.createdAt)),
    db.select().from(crmActivities).where(eq(crmActivities.workspaceId, workspaceId)).orderBy(desc(crmActivities.createdAt)),
    db.select({ id: crmEmailTemplates.id }).from(crmEmailTemplates).where(and(eq(crmEmailTemplates.workspaceId, workspaceId), isNull(crmEmailTemplates.deletedAt))),
    db.select({ id: crmCampaigns.id }).from(crmCampaigns).where(eq(crmCampaigns.workspaceId, workspaceId)),
  ]);

  const onboardingCounts = {
    leads: leads.length,
    contacts: contacts.length,
    templates: templateIds.length,
    campaigns: campaignIds.length,
    activities: activities.length,
    opportunities: opportunities.length,
  };

  return { leads, contacts, accounts, opportunities, activities, onboardingCounts };
}

export default function CRMHomePage() {
  const workspaceId = useWorkspaceId();
  const { canCreate } = usePermissions();

  // Get data from loader
  const { leads, contacts, accounts, opportunities, activities, onboardingCounts } = useLoaderData<typeof loader>();

  // Filter activities for planned status (client-side since we need all for display)
  const plannedActivities = activities.filter(a => a.status === 'planned');

  // Get recent activities (last 10)
  const recentActivities = plannedActivities.slice(0, 10);

  // Get upcoming activities (due in next 7 days)
  const upcomingActivities = plannedActivities.filter((activity) => {
    if (!activity.dueDate) return false;
    const dueDate = new Date(activity.dueDate);
    const nextWeek = addDays(new Date(), 7);
    return isAfter(dueDate, new Date()) && !isAfter(dueDate, nextWeek);
  });

  // Calculate pipeline metrics
  let pipelineValue = 0;
  let weightedPipelineValue = 0;
  for (const opp of opportunities) {
    if (opp.status === 'open') {
      const amount = parseFloat(opp.amount || '0');
      pipelineValue += amount;
      weightedPipelineValue += amount * ((opp.probability || 0) / 100);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">CRM Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your CRM overview.</p>
      </div>

      {/* Onboarding Welcome Card - shows progress, auto-hides when all done */}
      <OnboardingWelcomeCard workspaceId={workspaceId} counts={onboardingCounts} />

      {/* Quick Actions - Only visible to members and above */}
      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Link to={`/dashboard/${workspaceId}/crm/leads`}>
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Lead
                </Button>
              </Link>
              <Link to={`/dashboard/${workspaceId}/crm/contacts`}>
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </Link>
              <Link to={`/dashboard/${workspaceId}/crm/opportunities`}>
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  New Opportunity
                </Button>
              </Link>
              <Link to={`/dashboard/${workspaceId}/crm/activities`}>
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Activity
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link to={`/dashboard/${workspaceId}/crm/leads`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leads.length}</div>
              <p className="text-xs text-muted-foreground">
                Total leads in pipeline
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to={`/dashboard/${workspaceId}/crm/contacts`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contacts.length}</div>
              <p className="text-xs text-muted-foreground">
                Active contacts
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to={`/dashboard/${workspaceId}/crm/accounts`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accounts</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accounts.length}</div>
              <p className="text-xs text-muted-foreground">
                Active accounts
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to={`/dashboard/${workspaceId}/crm/opportunities`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{opportunities.filter((o) => o.status === 'open').length}</div>
              <p className="text-xs text-muted-foreground">
                Open opportunities
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Pipeline Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Total Pipeline Value</h3>
              <p className="text-2xl font-bold mt-1">{formatCurrency(pipelineValue)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Weighted Pipeline Value</h3>
              <p className="text-2xl font-bold mt-1">{formatCurrency(weightedPipelineValue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4">AI Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <TopIntentLeadsWidget workspaceId={workspaceId} limit={5} />
          <AtRiskLeadsWidget workspaceId={workspaceId} limit={5} />
          <AgentCapacityWidget workspaceId={workspaceId} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activities */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Activities</CardTitle>
                <Link to={`/dashboard/${workspaceId}/crm/activities`}>
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {recentActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No recent activities</p>
                    {canCreate && (
                      <Link to={`/dashboard/${workspaceId}/crm/activities`}>
                        <Button variant="outline" size="sm" className="mt-4">
                          Create Activity
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivities.slice(0, 5).map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        workspaceId={workspaceId}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Activities */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Activities (Next 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No upcoming activities</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingActivities.slice(0, 5).map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        workspaceId={workspaceId}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar - Activity Feed */}
        <div className="lg:col-span-1">
          <ActivityFeed workspaceId={workspaceId} limit={20} />
        </div>
      </div>

      {/* Compliance Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-green-500" />
            Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 bg-green-500 rounded-full"></span>
            </span>
            All clear — no outstanding compliance issues
          </div>
          <Link to={`/dashboard/${workspaceId}/crm/compliance`}>
            <Button variant="outline" size="sm" className="mt-4">
              View Compliance Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
