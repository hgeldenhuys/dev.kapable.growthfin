/**
 * Automation Analytics Page
 * Phase U: Advanced Automation
 *
 * Shows automation performance: workflow analytics, trigger effectiveness,
 * approval queue, and lead routing.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { toast } from 'sonner';
import { apiRequest } from '~/lib/api';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Switch } from '~/components/ui/switch';
import { Skeleton } from '~/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import {
  Zap,
  GitBranch,
  UserCheck,
  Route,
  Plus,
  Trash2,
  Check,
  X,
  Clock,
  Target,
  ArrowUpDown,
  RefreshCw,
  Pencil,
  AlertCircle,
} from 'lucide-react';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowAnalytics {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'draft' | 'archived';
  enrollments: number;
  activeEnrollments: number;
  completionRate: number;
  avgCompletionTime?: string;
}

interface TriggerAnalytics {
  id: string;
  name: string;
  eventType: string;
  firedCount: number;
  lastFiredAt: string | null;
  status: 'active' | 'paused';
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  avgDecisionTimeHours: number;
}

interface ApprovalItem {
  id: string;
  stepName: string;
  workflowName: string;
  entityType: 'lead' | 'contact' | 'opportunity';
  entityName: string;
  entityId: string;
  requestedAt: string;
  expiresAt: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  notes?: string;
}

interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions: Record<string, unknown>;
  assignToUserId: string;
  assignToUserName?: string;
  roundRobin: boolean;
  matchCount: number;
  status: 'active' | 'paused';
  createdAt: string;
}

interface RoutingAnalytics {
  totalRules: number;
  activeRules: number;
  totalMatches: number;
  topRule?: { name: string; matchCount: number };
}

interface WorkspaceMember {
  id: string;
  name: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// API Hooks
// ---------------------------------------------------------------------------

function useWorkflowAnalytics(workspaceId: string) {
  return useQuery({
    queryKey: ['automation', 'workflows', workspaceId],
    queryFn: async (): Promise<WorkflowAnalytics[]> => {
      const res = await apiRequest(
        `/api/v1/crm/automation/analytics/workflows?workspaceId=${workspaceId}`
      );
      if (!res.ok) throw new Error('Failed to fetch workflow analytics');
      const data = await res.json();
      return data.workflows ?? [];
    },
    enabled: !!workspaceId,
  });
}

function useTriggerAnalytics(workspaceId: string) {
  return useQuery({
    queryKey: ['automation', 'triggers', workspaceId],
    queryFn: async (): Promise<TriggerAnalytics[]> => {
      const res = await apiRequest(
        `/api/v1/crm/automation/analytics/triggers?workspaceId=${workspaceId}`
      );
      if (!res.ok) throw new Error('Failed to fetch trigger analytics');
      const data = await res.json();
      return data.triggers ?? [];
    },
    enabled: !!workspaceId,
  });
}

function useApprovalStats(workspaceId: string) {
  return useQuery({
    queryKey: ['automation', 'approval-stats', workspaceId],
    queryFn: async (): Promise<ApprovalStats> => {
      const res = await apiRequest(
        `/api/v1/crm/automation/analytics/approvals?workspaceId=${workspaceId}`
      );
      if (!res.ok) throw new Error('Failed to fetch approval stats');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

function useApprovals(workspaceId: string, status?: string) {
  return useQuery({
    queryKey: ['automation', 'approvals', workspaceId, status],
    queryFn: async (): Promise<ApprovalItem[]> => {
      const params = new URLSearchParams({ workspaceId });
      if (status) params.set('status', status);
      const res = await apiRequest(
        `/api/v1/crm/automation/approvals?${params.toString()}`
      );
      if (!res.ok) throw new Error('Failed to fetch approvals');
      const data = await res.json();
      return data.approvals ?? [];
    },
    enabled: !!workspaceId,
  });
}

function useApproveApproval(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await apiRequest(
        `/api/v1/crm/automation/approvals/${id}/approve?workspaceId=${workspaceId}`,
        { method: 'POST', body: JSON.stringify({ notes }) }
      );
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation', 'approvals', workspaceId] });
      qc.invalidateQueries({ queryKey: ['automation', 'approval-stats', workspaceId] });
    },
  });
}

function useRejectApproval(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await apiRequest(
        `/api/v1/crm/automation/approvals/${id}/reject?workspaceId=${workspaceId}`,
        { method: 'POST', body: JSON.stringify({ notes }) }
      );
      if (!res.ok) throw new Error('Failed to reject');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation', 'approvals', workspaceId] });
      qc.invalidateQueries({ queryKey: ['automation', 'approval-stats', workspaceId] });
    },
  });
}

function useRoutingAnalytics(workspaceId: string) {
  return useQuery({
    queryKey: ['automation', 'routing-analytics', workspaceId],
    queryFn: async (): Promise<RoutingAnalytics> => {
      const res = await apiRequest(
        `/api/v1/crm/automation/analytics/routing?workspaceId=${workspaceId}`
      );
      if (!res.ok) throw new Error('Failed to fetch routing analytics');
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

function useRoutingRules(workspaceId: string) {
  return useQuery({
    queryKey: ['automation', 'routing-rules', workspaceId],
    queryFn: async (): Promise<RoutingRule[]> => {
      const res = await apiRequest(
        `/api/v1/crm/automation/routing-rules?workspaceId=${workspaceId}`
      );
      if (!res.ok) throw new Error('Failed to fetch routing rules');
      const data = await res.json();
      return data.rules ?? [];
    },
    enabled: !!workspaceId,
  });
}

function useCreateRoutingRule(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest(`/api/v1/crm/automation/routing-rules`, {
        method: 'POST',
        body: JSON.stringify({ ...body, workspaceId }),
      });
      if (!res.ok) throw new Error('Failed to create routing rule');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation', 'routing-rules', workspaceId] });
      qc.invalidateQueries({ queryKey: ['automation', 'routing-analytics', workspaceId] });
    },
  });
}

function useUpdateRoutingRule(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const res = await apiRequest(
        `/api/v1/crm/automation/routing-rules/${id}?workspaceId=${workspaceId}`,
        { method: 'PATCH', body: JSON.stringify(body) }
      );
      if (!res.ok) throw new Error('Failed to update routing rule');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation', 'routing-rules', workspaceId] });
      qc.invalidateQueries({ queryKey: ['automation', 'routing-analytics', workspaceId] });
    },
  });
}

function useDeleteRoutingRule(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(
        `/api/v1/crm/automation/routing-rules/${id}?workspaceId=${workspaceId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete routing rule');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation', 'routing-rules', workspaceId] });
      qc.invalidateQueries({ queryKey: ['automation', 'routing-analytics', workspaceId] });
    },
  });
}

function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: async (): Promise<WorkspaceMember[]> => {
      const res = await apiRequest(`/api/v1/workspaces/${workspaceId}/members`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.members ?? [];
    },
    enabled: !!workspaceId,
  });
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconClassName ?? 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
    archived: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
  };
  return (
    <Badge className={variants[status] ?? ''}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <Alert>
      <Icon className="h-4 w-4" />
      <AlertTitle>No Data</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 0) {
    const absMins = Math.abs(diffMins);
    if (absMins < 60) return `${absMins}m ago`;
    if (absMins < 1440) return `${Math.round(absMins / 60)}h ago`;
    return `${Math.round(absMins / 1440)}d ago`;
  }
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffMins < 1440) return `in ${Math.round(diffMins / 60)}h`;
  return `in ${Math.round(diffMins / 1440)}d`;
}

function summarizeConditions(conditions: Record<string, unknown>): string {
  if (!conditions || typeof conditions !== 'object') return '-';
  const entries = Object.entries(conditions);
  if (entries.length === 0) return 'No conditions';
  return entries
    .slice(0, 3)
    .map(([key, val]) => `${key}: ${String(val)}`)
    .join(', ') + (entries.length > 3 ? ` (+${entries.length - 3} more)` : '');
}

// ---------------------------------------------------------------------------
// Tab: Overview
// ---------------------------------------------------------------------------

function OverviewTab({ workspaceId }: { workspaceId: string }) {
  const { data: workflows, isLoading: wfLoading } = useWorkflowAnalytics(workspaceId);
  const { data: triggers, isLoading: trLoading } = useTriggerAnalytics(workspaceId);
  const { data: approvalStats } = useApprovalStats(workspaceId);
  const { data: routingAnalytics } = useRoutingAnalytics(workspaceId);

  const activeWorkflows = workflows?.filter((w) => w.status === 'active').length ?? 0;
  const activeTriggers = triggers?.filter((t) => t.status === 'active').length ?? 0;
  const pendingApprovals = approvalStats?.pending ?? 0;
  const activeRoutingRules = routingAnalytics?.activeRules ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Workflows"
          value={activeWorkflows}
          subtitle={`${workflows?.length ?? 0} total`}
          icon={GitBranch}
          iconClassName="text-blue-600"
        />
        <StatCard
          title="Active Triggers"
          value={activeTriggers}
          subtitle={`${triggers?.length ?? 0} total`}
          icon={Zap}
          iconClassName="text-yellow-600"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingApprovals}
          subtitle={
            approvalStats
              ? `Avg ${Math.round(approvalStats.avgDecisionTimeHours)}h decision`
              : undefined
          }
          icon={UserCheck}
          iconClassName="text-purple-600"
        />
        <StatCard
          title="Active Routing Rules"
          value={activeRoutingRules}
          subtitle={
            routingAnalytics?.totalMatches
              ? `${routingAnalytics.totalMatches} total matches`
              : undefined
          }
          icon={Route}
          iconClassName="text-green-600"
        />
      </div>

      {/* Workflow Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Workflow Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wfLoading ? (
            <TableSkeleton cols={6} />
          ) : !workflows || workflows.length === 0 ? (
            <EmptyState icon={GitBranch} message="No workflows found. Create a workflow to get started." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Name</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-right py-3 px-2 font-medium">Enrollments</th>
                    <th className="text-right py-3 px-2 font-medium">Active</th>
                    <th className="text-right py-3 px-2 font-medium">Completion Rate</th>
                    <th className="text-right py-3 px-2 font-medium">Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((wf) => (
                    <tr key={wf.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{wf.name}</td>
                      <td className="py-3 px-2">
                        <StatusBadge status={wf.status} />
                      </td>
                      <td className="py-3 px-2 text-right">{wf.enrollments}</td>
                      <td className="py-3 px-2 text-right">{wf.activeEnrollments}</td>
                      <td className="py-3 px-2 text-right">{wf.completionRate}%</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {wf.avgCompletionTime ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trigger Effectiveness Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Trigger Effectiveness
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trLoading ? (
            <TableSkeleton cols={4} />
          ) : !triggers || triggers.length === 0 ? (
            <EmptyState icon={Zap} message="No triggers found. Add triggers to workflows to start tracking." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Name</th>
                    <th className="text-left py-3 px-2 font-medium">Event Type</th>
                    <th className="text-right py-3 px-2 font-medium">Fired Count</th>
                    <th className="text-right py-3 px-2 font-medium">Last Fired</th>
                  </tr>
                </thead>
                <tbody>
                  {triggers.map((tr) => (
                    <tr key={tr.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{tr.name}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline">{tr.eventType}</Badge>
                      </td>
                      <td className="py-3 px-2 text-right">{tr.firedCount}</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {formatRelative(tr.lastFiredAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Approvals
// ---------------------------------------------------------------------------

function ApprovalsTab({ workspaceId }: { workspaceId: string }) {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [actionItem, setActionItem] = useState<ApprovalItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionNotes, setActionNotes] = useState('');

  const { data: stats, isLoading: statsLoading } = useApprovalStats(workspaceId);
  const { data: approvals, isLoading: approvalsLoading } = useApprovals(workspaceId, statusFilter);

  const approveMutation = useApproveApproval(workspaceId);
  const rejectMutation = useRejectApproval(workspaceId);

  const handleOpenAction = (item: ApprovalItem, type: 'approve' | 'reject') => {
    setActionItem(item);
    setActionType(type);
    setActionNotes('');
  };

  const handleConfirmAction = async () => {
    if (!actionItem) return;

    try {
      if (actionType === 'approve') {
        await approveMutation.mutateAsync({ id: actionItem.id, notes: actionNotes || undefined });
        toast.success('Approved');
      } else {
        await rejectMutation.mutateAsync({ id: actionItem.id, notes: actionNotes || undefined });
        toast.success('Rejected');
      }
      setActionItem(null);
    } catch (err: any) {
      toast.error(`${actionType === 'approve' ? 'Approve' : 'Reject'} Failed`, { description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard title="Pending" value={stats?.pending ?? 0} icon={Clock} iconClassName="text-yellow-600" />
            <StatCard title="Approved" value={stats?.approved ?? 0} icon={Check} iconClassName="text-green-600" />
            <StatCard title="Rejected" value={stats?.rejected ?? 0} icon={X} iconClassName="text-red-600" />
            <StatCard title="Expired" value={stats?.expired ?? 0} icon={AlertCircle} iconClassName="text-gray-600" />
            <StatCard
              title="Avg Decision Time"
              value={stats ? `${Math.round(stats.avgDecisionTimeHours)}h` : '-'}
              icon={Clock}
              iconClassName="text-blue-600"
            />
          </>
        )}
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Filter:</Label>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {['pending', 'approved', 'rejected', 'expired', 'all'].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(s === 'all' ? '' : s)}
            >
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Approvals List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {statusFilter ? `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Approvals` : 'All Approvals'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvalsLoading ? (
            <TableSkeleton cols={6} />
          ) : !approvals || approvals.length === 0 ? (
            <EmptyState icon={UserCheck} message={`No ${statusFilter || ''} approvals found.`} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Step Name</th>
                    <th className="text-left py-3 px-2 font-medium">Workflow</th>
                    <th className="text-left py-3 px-2 font-medium">Entity</th>
                    <th className="text-left py-3 px-2 font-medium">Requested</th>
                    <th className="text-left py-3 px-2 font-medium">Expires</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    {statusFilter === 'pending' && (
                      <th className="text-right py-3 px-2 font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{item.stepName}</td>
                      <td className="py-3 px-2 text-muted-foreground">{item.workflowName}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {item.entityType}
                          </Badge>
                          <span>{item.entityName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {formatRelative(item.requestedAt)}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {formatRelative(item.expiresAt)}
                      </td>
                      <td className="py-3 px-2">
                        <StatusBadge status={item.status} />
                      </td>
                      {statusFilter === 'pending' && (
                        <td className="py-3 px-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleOpenAction(item, 'approve')}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleOpenAction(item, 'reject')}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve / Reject Dialog */}
      <Dialog open={!!actionItem} onOpenChange={(open) => !open && setActionItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve' : 'Reject'} - {actionItem?.stepName}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? `Approve this step for ${actionItem?.entityName}?`
                : `Reject this step for ${actionItem?.entityName}?`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Workflow</div>
              <div className="font-medium">{actionItem?.workflowName}</div>
              <div className="text-muted-foreground">Entity</div>
              <div className="font-medium capitalize">
                {actionItem?.entityType}: {actionItem?.entityName}
              </div>
              <div className="text-muted-foreground">Requested</div>
              <div>{formatDate(actionItem?.requestedAt)}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="action-notes">Notes (optional)</Label>
              <Textarea
                id="action-notes"
                placeholder={actionType === 'approve' ? 'Approval notes...' : 'Reason for rejection...'}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionItem(null)}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              onClick={handleConfirmAction}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {approveMutation.isPending || rejectMutation.isPending
                ? 'Processing...'
                : actionType === 'approve'
                ? 'Approve'
                : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Lead Routing
// ---------------------------------------------------------------------------

interface RoutingRuleFormData {
  name: string;
  description: string;
  priority: number;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  assignToUserId: string;
  roundRobin: boolean;
}

const INITIAL_FORM_DATA: RoutingRuleFormData = {
  name: '',
  description: '',
  priority: 1,
  conditionField: '',
  conditionOperator: 'equals',
  conditionValue: '',
  assignToUserId: '',
  roundRobin: false,
};

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
];

function LeadRoutingTab({ workspaceId }: { workspaceId: string }) {
  const { data: rules, isLoading } = useRoutingRules(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  const createMutation = useCreateRoutingRule(workspaceId);
  const updateMutation = useUpdateRoutingRule(workspaceId);
  const deleteMutation = useDeleteRoutingRule(workspaceId);

  const [showCreate, setShowCreate] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [formData, setFormData] = useState<RoutingRuleFormData>(INITIAL_FORM_DATA);

  const openCreateDialog = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditingRule(null);
    setShowCreate(true);
  };

  const openEditDialog = (rule: RoutingRule) => {
    const conds = rule.conditions as Record<string, unknown> ?? {};
    const firstEntry = Object.entries(conds)[0];
    setFormData({
      name: rule.name,
      description: rule.description ?? '',
      priority: rule.priority,
      conditionField: firstEntry?.[0] ?? '',
      conditionOperator: (firstEntry?.[1] as any)?.operator ?? 'equals',
      conditionValue: String((firstEntry?.[1] as any)?.value ?? ''),
      assignToUserId: rule.assignToUserId,
      roundRobin: rule.roundRobin,
    });
    setEditingRule(rule);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Validation Error', { description: 'Name is required.' });
      return;
    }

    const conditions: Record<string, unknown> = {};
    if (formData.conditionField.trim()) {
      conditions[formData.conditionField.trim()] = {
        operator: formData.conditionOperator,
        value: formData.conditionValue,
      };
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      conditions,
      assignToUserId: formData.assignToUserId || undefined,
      roundRobin: formData.roundRobin,
    };

    try {
      if (editingRule) {
        await updateMutation.mutateAsync({ id: editingRule.id, ...payload });
        toast.success('Rule Updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Rule Created');
      }
      setShowCreate(false);
      setEditingRule(null);
    } catch (err: any) {
      toast.error('Save Failed', { description: err.message });
    }
  };

  const handleDelete = async (rule: RoutingRule) => {
    try {
      await deleteMutation.mutateAsync(rule.id);
      toast.success('Rule Deleted');
    } catch (err: any) {
      toast.error('Delete Failed', { description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Lead Routing Rules</h2>
          <p className="text-sm text-muted-foreground">
            Configure how incoming leads are assigned to team members
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Rule
        </Button>
      </div>

      {/* Rules Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <TableSkeleton cols={7} />
          ) : !rules || rules.length === 0 ? (
            <EmptyState icon={Route} message="No routing rules configured. Create a rule to start auto-assigning leads." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Name</th>
                    <th className="text-center py-3 px-2 font-medium">
                      <div className="flex items-center justify-center gap-1">
                        <ArrowUpDown className="h-3 w-3" />
                        Priority
                      </div>
                    </th>
                    <th className="text-left py-3 px-2 font-medium">Conditions</th>
                    <th className="text-left py-3 px-2 font-medium">Assign To</th>
                    <th className="text-center py-3 px-2 font-medium">Round Robin</th>
                    <th className="text-right py-3 px-2 font-medium">Matches</th>
                    <th className="text-center py-3 px-2 font-medium">Status</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div>
                          <div className="font-medium">{rule.name}</div>
                          {rule.description && (
                            <div className="text-xs text-muted-foreground">{rule.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">{rule.priority}</td>
                      <td className="py-3 px-2 text-muted-foreground text-xs max-w-[200px] truncate">
                        {summarizeConditions(rule.conditions as Record<string, unknown>)}
                      </td>
                      <td className="py-3 px-2">{rule.assignToUserName || rule.assignToUserId || '-'}</td>
                      <td className="py-3 px-2 text-center">
                        {rule.roundRobin ? (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                            Round Robin
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right font-medium">{rule.matchCount}</td>
                      <td className="py-3 px-2 text-center">
                        <StatusBadge status={rule.status} />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(rule)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(rule)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditingRule(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Routing Rule' : 'Create Routing Rule'}</DialogTitle>
            <DialogDescription>
              {editingRule
                ? 'Update the routing rule configuration.'
                : 'Define conditions for automatically assigning leads.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                placeholder="e.g., Enterprise leads to Sales Team"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">Description</Label>
              <Textarea
                id="rule-description"
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-priority">Priority (lower = higher priority)</Label>
              <Input
                id="rule-priority"
                type="number"
                min={1}
                value={formData.priority}
                onChange={(e) => setFormData((p) => ({ ...p, priority: parseInt(e.target.value) || 1 }))}
              />
            </div>

            {/* Condition Builder */}
            <div className="space-y-2">
              <Label>Condition</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Field (e.g., industry)"
                  value={formData.conditionField}
                  onChange={(e) => setFormData((p) => ({ ...p, conditionField: e.target.value }))}
                />
                <Select
                  value={formData.conditionOperator}
                  onValueChange={(val) => setFormData((p) => ({ ...p, conditionOperator: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Value"
                  value={formData.conditionValue}
                  onChange={(e) => setFormData((p) => ({ ...p, conditionValue: e.target.value }))}
                />
              </div>
            </div>

            {/* Assign To */}
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select
                value={formData.assignToUserId}
                onValueChange={(val) => setFormData((p) => ({ ...p, assignToUserId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {(members ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                  {(!members || members.length === 0) && (
                    <SelectItem value="_none" disabled>
                      No members found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Round Robin Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Round Robin</Label>
                <p className="text-xs text-muted-foreground">
                  Distribute leads evenly across team members
                </p>
              </div>
              <Switch
                checked={formData.roundRobin}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, roundRobin: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditingRule(null); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingRule
                ? 'Update Rule'
                : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Analytics
// ---------------------------------------------------------------------------

function AnalyticsTab({ workspaceId }: { workspaceId: string }) {
  const { data: workflows, isLoading: wfLoading } = useWorkflowAnalytics(workspaceId);
  const { data: triggers, isLoading: trLoading } = useTriggerAnalytics(workspaceId);
  const { data: approvalStats, isLoading: asLoading } = useApprovalStats(workspaceId);
  const { data: routingAnalytics, isLoading: raLoading } = useRoutingAnalytics(workspaceId);
  const { data: rules, isLoading: rulesLoading } = useRoutingRules(workspaceId);

  return (
    <div className="space-y-6">
      {/* Workflow Completion Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Workflow Completion Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wfLoading ? (
            <TableSkeleton cols={3} />
          ) : !workflows || workflows.length === 0 ? (
            <EmptyState icon={GitBranch} message="No workflow data available." />
          ) : (
            <div className="space-y-3">
              {workflows.map((wf) => (
                <div key={wf.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{wf.name}</span>
                      <span className="text-sm text-muted-foreground">{wf.completionRate}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(100, wf.completionRate)}%` }}
                      />
                    </div>
                  </div>
                  <StatusBadge status={wf.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trigger Fire Counts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Trigger Fire Counts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trLoading ? (
            <TableSkeleton cols={3} />
          ) : !triggers || triggers.length === 0 ? (
            <EmptyState icon={Zap} message="No trigger data available." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Trigger</th>
                    <th className="text-left py-3 px-2 font-medium">Event Type</th>
                    <th className="text-right py-3 px-2 font-medium">Fire Count</th>
                    <th className="text-right py-3 px-2 font-medium">Last Fired</th>
                  </tr>
                </thead>
                <tbody>
                  {[...triggers]
                    .sort((a, b) => b.firedCount - a.firedCount)
                    .map((tr) => (
                      <tr key={tr.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium">{tr.name}</td>
                        <td className="py-3 px-2">
                          <Badge variant="outline">{tr.eventType}</Badge>
                        </td>
                        <td className="py-3 px-2 text-right font-medium">{tr.firedCount}</td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {formatDate(tr.lastFiredAt)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Decision Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Approval Decision Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          {asLoading ? (
            <TableSkeleton cols={2} rows={3} />
          ) : !approvalStats ? (
            <EmptyState icon={UserCheck} message="No approval data available." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{approvalStats.pending}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{approvalStats.approved}</div>
                <div className="text-sm text-muted-foreground">Approved</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{approvalStats.rejected}</div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(approvalStats.avgDecisionTimeHours)}h
                </div>
                <div className="text-sm text-muted-foreground">Avg Decision Time</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Routing Rule Effectiveness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Routing Rule Effectiveness
          </CardTitle>
        </CardHeader>
        <CardContent>
          {raLoading || rulesLoading ? (
            <TableSkeleton cols={3} />
          ) : !routingAnalytics || !rules || rules.length === 0 ? (
            <EmptyState icon={Route} message="No routing data available." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{routingAnalytics.totalRules}</div>
                  <div className="text-sm text-muted-foreground">Total Rules</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{routingAnalytics.activeRules}</div>
                  <div className="text-sm text-muted-foreground">Active Rules</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{routingAnalytics.totalMatches}</div>
                  <div className="text-sm text-muted-foreground">Total Matches</div>
                </div>
              </div>

              {routingAnalytics.topRule && (
                <div className="p-4 border rounded-lg flex items-center gap-3">
                  <Target className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Top Performing Rule</div>
                    <div className="text-sm text-muted-foreground">
                      {routingAnalytics.topRule.name} - {routingAnalytics.topRule.matchCount} matches
                    </div>
                  </div>
                </div>
              )}

              {/* Per-rule match counts */}
              <div className="space-y-2">
                {[...rules]
                  .sort((a, b) => b.matchCount - a.matchCount)
                  .map((rule) => (
                    <div key={rule.id} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{rule.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {rule.matchCount} matches
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2 transition-all"
                            style={{
                              width: `${
                                routingAnalytics.totalMatches > 0
                                  ? Math.round((rule.matchCount / routingAnalytics.totalMatches) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                      <StatusBadge status={rule.status} />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AutomationAnalyticsPage() {
  const workspaceId = useWorkspaceId();
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['automation'] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Zap className="h-8 w-8 text-primary" />
            Automation Analytics
          </h1>
          <p className="text-muted-foreground">
            Monitor workflow performance, triggers, approvals, and lead routing
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <GitBranch className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="routing" className="flex items-center gap-1.5">
            <Route className="h-4 w-4" />
            Lead Routing
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1.5">
            <Target className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="approvals" className="mt-6">
          <ApprovalsTab workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="routing" className="mt-6">
          <LeadRoutingTab workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <AnalyticsTab workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
