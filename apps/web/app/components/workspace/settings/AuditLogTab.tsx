/**
 * Audit Log Tab
 * US-UI-007: Display workspace activity history
 *
 * Features:
 * - Recent activity display
 * - Filters: user, action, resource type, date range
 * - Export to CSV functionality
 * - Pagination for large datasets
 * - Shows who did what, when
 * - Displays before/after changes if available
 * - Admin+ only access (enforced by route)
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Input } from "../../ui/input";
import { Avatar, AvatarFallback } from "../../ui/avatar";
import { Badge } from "../../ui/badge";
import { Activity, Download, Filter, Loader2 } from "lucide-react";
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

interface AuditLogTabProps {
  workspaceId: string;
}

export function AuditLogTab({ workspaceId }: AuditLogTabProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({
    action: 'all',
    resourceType: 'all',
    dateFrom: '',
    dateTo: ''
  });
  // Client-side uses proxy routes


  useEffect(() => {
    fetchAuditLogs();
  }, [workspaceId, filters, page]);

  async function fetchAuditLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(filters.action && filters.action !== 'all' && { action: filters.action }),
        ...(filters.resourceType && filters.resourceType !== 'all' && { resourceType: filters.resourceType }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
      });

      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/audit-log?${params}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch audit log: ${response.statusText}`);
      }

      const data = await response.json();

      if (page === 1) {
        setLogs(data.logs || []);
      } else {
        setLogs(prev => [...prev, ...(data.logs || [])]);
      }

      setHasMore((data.logs || []).length >= 50);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast.error('Error', { description: 'Failed to load audit log. Please try again.' });
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        ...(filters.action && filters.action !== 'all' && { action: filters.action }),
        ...(filters.resourceType && filters.resourceType !== 'all' && { resourceType: filters.resourceType }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
      });

      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/audit-log/export?${params}`
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${workspaceId}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Success', { description: 'Audit log exported successfully' });
    } catch (error) {
      console.error('Failed to export audit log:', error);
      toast.error('Error', { description: 'Failed to export audit log. Please try again.' });
    } finally {
      setExporting(false);
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page on filter change
  }

  function handleLoadMore() {
    setPage(prev => prev + 1);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Audit Log
            </CardTitle>
            <CardDescription>
              View workspace activity and changes
            </CardDescription>
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            disabled={exporting || logs.length === 0}
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Select
            value={filters.action}
            onValueChange={(v) => handleFilterChange('action', v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="invited_member">Invited Member</SelectItem>
              <SelectItem value="changed_role">Changed Role</SelectItem>
              <SelectItem value="removed_member">Removed Member</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.resourceType}
            onValueChange={(v) => handleFilterChange('resourceType', v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by resource" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources</SelectItem>
              <SelectItem value="workspace_member">Members</SelectItem>
              <SelectItem value="campaign">Campaigns</SelectItem>
              <SelectItem value="contact">Contacts</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="account">Accounts</SelectItem>
              <SelectItem value="opportunity">Opportunities</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            placeholder="From date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            className="w-48"
          />

          <Input
            type="date"
            placeholder="To date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            className="w-48"
          />

          {(filters.action !== 'all' || filters.resourceType !== 'all' || filters.dateFrom || filters.dateTo) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFilters({ action: 'all', resourceType: 'all', dateFrom: '', dateTo: '' });
                setPage(1);
              }}
            >
              <Filter className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Activity List */}
        {loading && page === 1 ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Loading audit log...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-2" />
            <p className="text-sm text-muted-foreground">No audit log entries found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <AuditLogItem key={log.id} log={log} />
            ))}

            {hasMore && (
              <div className="pt-4 text-center">
                <Button
                  onClick={handleLoadMore}
                  variant="outline"
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuditLogItem({ log }: { log: AuditLogEntry }) {
  const userName = log.userName || 'Unknown User';
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="flex items-start gap-3 pb-4 border-b last:border-0">
      <Avatar className="h-8 w-8 mt-1">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm">
            <span className="font-medium">{userName}</span>
            {' '}
            <span className="text-muted-foreground">{formatAction(log.action)}</span>
            {log.resourceType && (
              <>
                {' '}
                <Badge variant="outline" className="ml-1">
                  {formatResourceType(log.resourceType)}
                </Badge>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
          </p>
        </div>

        {log.changes && (log.changes.before || log.changes.after) && (
          <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
            {log.changes.before && (
              <div className="mb-1">
                <span className="font-medium">Before:</span>{' '}
                {formatChanges(log.changes.before)}
              </div>
            )}
            {log.changes.after && (
              <div>
                <span className="font-medium">After:</span>{' '}
                {formatChanges(log.changes.after)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    invited_member: 'invited member',
    changed_role: 'changed role for',
    removed_member: 'removed member',
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

function formatChanges(changes: any): string {
  if (typeof changes === 'string') return changes;
  if (typeof changes === 'object' && changes !== null) {
    // Extract key fields for display
    if (changes.role) return changes.role;
    if (changes.name) return changes.name;
    if (changes.email) return changes.email;
    if (changes.status) return changes.status;
    return JSON.stringify(changes);
  }
  return String(changes);
}
