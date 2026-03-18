/**
 * Activity Feed Component
 * US-UI-009: Show recent changes in real-time
 *
 * Features:
 * - Shows recent workspace changes
 * - Real-time updates via SSE (optional for MVP)
 * - Filterable by resource type
 * - Links to affected resources
 * - Shows user avatars
 * - Relative timestamps ("2 hours ago")
 * - Limit to last 50 activities
 */

import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Activity, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from 'sonner';

interface AuditLogEntry {
  id: string;
  workspaceId: string;
  userId: string | null;
  userName: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  changes: {
    before?: any;
    after?: any;
  } | null;
  metadata: any | null;
  createdAt: string;
}

interface ActivityFeedProps {
  workspaceId: string;
  limit?: number;
  showFilter?: boolean;
}

export function ActivityFeed({ workspaceId, limit = 50, showFilter = true }: ActivityFeedProps) {
  const [activities, setActivities] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  // Client-side uses proxy routes


  useEffect(() => {
    fetchActivities();
  }, [workspaceId, filter]);

  async function fetchActivities() {
    setLoading(true);
    try {
      // TODO(TWEAK-002): Audit log endpoint not yet implemented - temporarily disabled
      // const params = new URLSearchParams({
      //   limit: limit.toString(),
      //   ...(filter !== 'all' && { resourceType: filter }),
      // });

      // const response = await fetch(
      //   `/api/v1/workspaces/${workspaceId}/audit-log?${params}`
      // );

      // if (!response.ok) {
      //   throw new Error(`Failed to fetch activities: ${response.statusText}`);
      // }

      // const data = await response.json();
      // setActivities(data.logs || []);

      // Temporarily return empty activities until audit log endpoint is implemented
      setActivities([]);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
      toast.error('Error', { description: 'Failed to load activity feed. Please try again.' });
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Feed
          </CardTitle>
          {showFilter && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="campaign">Campaigns</SelectItem>
                <SelectItem value="contact">Contacts</SelectItem>
                <SelectItem value="lead">Leads</SelectItem>
                <SelectItem value="account">Accounts</SelectItem>
                <SelectItem value="opportunity">Opportunities</SelectItem>
                <SelectItem value="workspace_member">Members</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-2">Loading activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} workspaceId={workspaceId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityItem({ activity, workspaceId }: { activity: AuditLogEntry; workspaceId: string }) {
  const userName = activity.userName || 'Unknown User';
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  // Build link to resource if available
  const resourceLink = getResourceLink(activity, workspaceId);

  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{userName}</span>
          {' '}
          <span className="text-muted-foreground">{formatAction(activity.action)}</span>
          {activity.resourceType && (
            <>
              {' '}
              {resourceLink ? (
                <Link
                  to={resourceLink}
                  className="text-primary hover:underline"
                >
                  <Badge variant="outline" className="ml-1 cursor-pointer hover:bg-primary/10">
                    {formatResourceType(activity.resourceType)}
                  </Badge>
                </Link>
              ) : (
                <Badge variant="outline" className="ml-1">
                  {formatResourceType(activity.resourceType)}
                </Badge>
              )}
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    invited_member: 'invited a member',
    changed_role: 'changed role',
    removed_member: 'removed a member',
    created: 'created',
    updated: 'updated',
    deleted: 'deleted',
  };
  return actionMap[action] || action.replace(/_/g, ' ');
}

function formatResourceType(resourceType: string): string {
  const typeMap: Record<string, string> = {
    workspace_member: 'Member',
    campaign: 'Campaign',
    contact: 'Contact',
    lead: 'Lead',
    account: 'Account',
    opportunity: 'Opportunity',
  };
  return typeMap[resourceType] || resourceType;
}

function getResourceLink(activity: AuditLogEntry, workspaceId: string): string | null {
  if (!activity.resourceId || !activity.resourceType) return null;

  const linkMap: Record<string, string> = {
    campaign: `/dashboard/${workspaceId}/crm/campaigns/${activity.resourceId}`,
    contact: `/dashboard/${workspaceId}/crm/contacts/${activity.resourceId}`,
    lead: `/dashboard/${workspaceId}/crm/leads/${activity.resourceId}`,
    account: `/dashboard/${workspaceId}/crm/accounts/${activity.resourceId}`,
    opportunity: `/dashboard/${workspaceId}/crm/opportunities/${activity.resourceId}`,
  };

  return linkMap[activity.resourceType] || null;
}
