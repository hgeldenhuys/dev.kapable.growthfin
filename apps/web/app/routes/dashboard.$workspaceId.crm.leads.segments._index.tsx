/**
 * Segments List Page
 * Display all lead segments with metrics
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Layers, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useSegments } from '~/hooks/useSegments';
import { toast } from 'sonner';
import { SegmentList } from '~/components/crm/leads/SegmentList';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function SegmentsPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  // Fetch segments with real-time updates
  const { data: segments = [], isLoading, error } = useSegments({ workspaceId });

  const handleCreate = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads/segments/new`);
  };

  const handleView = (segmentId: string) => {
    navigate(`/dashboard/${workspaceId}/crm/leads/segments/${segmentId}`);
  };

  // Stats
  const stats = {
    total: segments.length,
    totalLeads: segments.reduce((sum, seg) => sum + (seg.memberCount || 0), 0),
    avgConversionRate: segments.length > 0
      ? segments.reduce((sum, seg) => sum + (seg.metrics?.conversionRate || 0), 0) / segments.length
      : 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading segments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading segments: {String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lead Segments</h1>
          <p className="text-muted-foreground">
            Create and manage dynamic lead segments with auto-refresh
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Segment
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Segments</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Active segments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all segments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.avgConversionRate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Average across segments</p>
          </CardContent>
        </Card>
      </div>

      {/* Segments List */}
      <SegmentList
        segments={segments}
        onView={handleView}
        workspaceId={workspaceId}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
