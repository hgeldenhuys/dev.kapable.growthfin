/**
 * Bulk Operations Page
 * UI for performing bulk actions on leads
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, CheckSquare, Edit, Trash2, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { useBulkOperations } from '~/hooks/useBulkOperations';
import { toast } from 'sonner';
import { BulkOperationProgress } from '~/components/crm/leads/BulkOperationProgress';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function BulkOperationsPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  // Fetch bulk operations history
  const { data: operations = [], isLoading } = useBulkOperations({ workspaceId });

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/crm/leads`);
  };

  // Stats
  const stats = {
    total: operations.length,
    pending: operations.filter(op => op.status === 'pending').length,
    running: operations.filter(op => op.status === 'running').length,
    completed: operations.filter(op => op.status === 'completed').length,
    failed: operations.filter(op => op.status === 'failed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Bulk Operations</h1>
          <p className="text-muted-foreground">
            Monitor and manage bulk operations on leads
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <CheckSquare className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Edit className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.running}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <Trash2 className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Operations List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading operations...
            </div>
          ) : operations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bulk operations yet. Go to leads list and select multiple leads to get started.
            </div>
          ) : (
            operations.map((operation) => (
              <BulkOperationProgress
                key={operation.id}
                operationId={operation.id}
                workspaceId={workspaceId}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
