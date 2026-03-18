/**
 * My Queue Page
 * Sales rep personal queue with priority sorting and real-time updates
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Target, Phone, Clock, TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { LeadStatusBadge } from '~/components/crm/LeadStatusBadge';
import { toast } from 'sonner';
import { useWorkspaceId, useUserId } from '~/hooks/useWorkspace';
import type { Lead } from '~/types/crm';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

interface QueueLead extends Lead {
  callbackDate?: string;
  lastContactDate?: string;
  propensityScore?: number;
  daysSinceLastContact?: number;
}

interface QueueStats {
  totalAssigned: number;
  overdueCallbacks: number;
  todayCallbacks: number;
  averagePropensityScore: number;
}

interface QueueResponse {
  leads: QueueLead[];
  stats: QueueStats;
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export default function MyQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get workspace and user context
  const workspaceId = useWorkspaceId();
  const userId = useUserId();

  // Fetch queue data
  const { data: queueData, isLoading, error } = useQuery({
    queryKey: ['crm', 'leads', 'my-queue', workspaceId, userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        userId,
      });

      const response = await fetch(`/api/v1/crm/leads/queue/my-queue?${params.toString()}`);
      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to fetch queue' });
        throw new Error(errorText || 'Failed to fetch queue');
      }
      return response.json() as Promise<QueueResponse>;
    },
    enabled: !!workspaceId && !!userId,
  });

  const leads = queueData?.leads || [];
  const stats = queueData?.stats || {
    totalAssigned: 0,
    overdueCallbacks: 0,
    todayCallbacks: 0,
    averagePropensityScore: 0,
  };

  // Claim next lead mutation
  const claimNext = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/v1/crm/leads/queue/claim-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, userId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        toast.error('Error', { description: errorText || 'Failed to claim lead' });
        throw new Error(errorText || 'Failed to claim lead');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.lead) {
        toast.success('Lead claimed', { description: `${data.lead.firstName} ${data.lead.lastName} added to your queue` });
        // Invalidate queue to refresh
        queryClient.invalidateQueries(['crm', 'leads', 'my-queue', workspaceId, userId]);
      } else {
        toast.success('No leads available', { description: data.message || 'No leads available to claim' });
      }
    },
  });

  // Real-time SSE updates (Task 2)
  useEffect(() => {
    if (!workspaceId || !userId) return;

    const eventSource = new EventSource(
      `/api/v1/crm/leads/queue/my-queue/stream?workspaceId=${workspaceId}&userId=${userId}`
    );

    eventSource.addEventListener('lead_assigned', (e) => {
      const lead = JSON.parse(e.data);
      queryClient.invalidateQueries(['crm', 'leads', 'my-queue', workspaceId, userId]);
      toast.success('New lead assigned', { description: `${lead.firstName} ${lead.lastName} added to your queue` });
    });

    eventSource.addEventListener('lead_claimed', (e) => {
      queryClient.invalidateQueries(['crm', 'leads', 'my-queue', workspaceId, userId]);
    });

    eventSource.addEventListener('lead_removed', (e) => {
      queryClient.invalidateQueries(['crm', 'leads', 'my-queue', workspaceId, userId]);
    });

    eventSource.addEventListener('lead_updated', (e) => {
      queryClient.invalidateQueries(['crm', 'leads', 'my-queue', workspaceId, userId]);
    });

    eventSource.onerror = () => {
      // Auto-reconnect handled by EventSource
      console.log('Queue SSE connection lost, reconnecting...');
    };

    return () => {
      eventSource.close();
    };
  }, [workspaceId, userId, queryClient]);

  // Handlers
  const handleViewLead = (lead: QueueLead) => {
    navigate(`/dashboard/${workspaceId}/crm/leads/${lead.id}`);
  };

  const handleClaimNext = () => {
    claimNext.mutate();
  };

  // Priority badge helper
  const getPriorityBadge = (lead: QueueLead) => {
    if (lead.callbackDate) {
      const callback = new Date(lead.callbackDate);
      const now = new Date();

      if (callback <= now) {
        return (
          <div className="flex items-center gap-1 text-red-600">
            <Clock className="h-3 w-3" />
            <span className="text-xs font-medium">Overdue</span>
          </div>
        );
      } else {
        return (
          <div className="flex items-center gap-1 text-yellow-600">
            <Clock className="h-3 w-3" />
            <span className="text-xs font-medium">Scheduled</span>
          </div>
        );
      }
    }

    if (lead.propensityScore && lead.propensityScore >= 70) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-3 w-3" />
          <span className="text-xs font-medium">High Score</span>
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading queue: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Queue</h1>
          <p className="text-muted-foreground">
            Your prioritized leads and available claims
          </p>
        </div>
        <Button
          onClick={handleClaimNext}
          disabled={claimNext.isPending}
        >
          {claimNext.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Claiming...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Claim Next Lead
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssigned}</div>
            <p className="text-xs text-muted-foreground">Assigned to you</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdueCallbacks}</div>
            <p className="text-xs text-muted-foreground">Needs immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.todayCallbacks}</div>
            <p className="text-xs text-muted-foreground">Scheduled today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averagePropensityScore.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">Propensity score</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Priority Queue ({leads.length} leads)</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-8">
              <Target className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Your queue is empty. Claim a lead to get started!
              </p>
              <Button onClick={handleClaimNext}>
                <Zap className="mr-2 h-4 w-4" />
                Claim Next Lead
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Callback</TableHead>
                  <TableHead>Last Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewLead(lead)}
                  >
                    <TableCell>
                      {getPriorityBadge(lead)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {lead.firstName} {lead.lastName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.companyName || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.email || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.phone || '—'}
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {lead.propensityScore?.toFixed(0) || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {lead.callbackDate ? (
                        new Date(lead.callbackDate).toLocaleDateString()
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.daysSinceLastContact !== undefined ? (
                        `${lead.daysSinceLastContact} days ago`
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
