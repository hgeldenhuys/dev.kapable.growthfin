/**
 * BulkOperationProgress Component
 * Display real-time progress of bulk operations
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { useBulkOperation, useRollbackBulkOperation } from '~/hooks/useBulkOperations';
import { toast } from 'sonner';

interface BulkOperationProgressProps {
  operationId: string;
  workspaceId: string;
  onComplete?: () => void;
}

export function BulkOperationProgress({
  operationId,
  workspaceId,
  onComplete,
}: BulkOperationProgressProps) {
  const { data: operation, isLoading } = useBulkOperation(operationId, workspaceId);
  const rollback = useRollbackBulkOperation();
  const [timeElapsed, setTimeElapsed] = useState(0);

  useEffect(() => {
    if (operation?.status === 'running' || operation?.status === 'pending') {
      const timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [operation?.status]);

  useEffect(() => {
    if (operation?.status === 'completed' && onComplete) {
      onComplete();
    }
  }, [operation?.status, onComplete]);

  const handleRollback = async () => {
    try {
      await rollback.mutateAsync({ operationId, workspaceId });
      toast.success('Rollback Started', { description: 'Reverting changes...' });
    } catch (error) {
      toast.error('Rollback Failed', { description: String(error) });
    }
  };

  if (isLoading || !operation) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading operation...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = operation.totalItems > 0
    ? (operation.processedItems / operation.totalItems) * 100
    : 0;

  const statusIcon = {
    pending: <Clock className="h-5 w-5 text-yellow-500" />,
    running: <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />,
    completed: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    failed: <XCircle className="h-5 w-5 text-red-500" />,
  }[operation.status];

  const statusColor = {
    pending: 'text-yellow-700 bg-yellow-50',
    running: 'text-blue-700 bg-blue-50',
    completed: 'text-green-700 bg-green-50',
    failed: 'text-red-700 bg-red-50',
  }[operation.status];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatOperationType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Check if rollback is available (within 5 minutes of completion)
  const isRollbackAvailable = operation.status === 'completed' &&
    operation.completedAt &&
    new Date().getTime() - new Date(operation.completedAt).getTime() < 5 * 60 * 1000;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {statusIcon}
            <div>
              <CardTitle className="text-base">
                {formatOperationType(operation.operationType)} Operation
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {operation.operationName || `${formatOperationType(operation.operationType)} ${operation.totalItems} leads`}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {operation.status.charAt(0).toUpperCase() + operation.status.slice(1)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {(operation.status === 'running' || operation.status === 'pending') && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{operation.processedItems} / {operation.totalItems} processed</span>
              {operation.status === 'running' && (
                <span>Estimated: {formatTime(timeElapsed * (operation.totalItems - operation.processedItems) / Math.max(operation.processedItems, 1))}</span>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t">
          <div>
            <div className="text-2xl font-bold text-green-600">{operation.successfulItems}</div>
            <div className="text-xs text-muted-foreground">Successful</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{operation.failedItems}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{operation.totalItems}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>

        {/* Time Info */}
        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Started: {new Date(operation.createdAt).toLocaleString()}</span>
          {operation.completedAt && (
            <span>Completed: {new Date(operation.completedAt).toLocaleString()}</span>
          )}
        </div>

        {/* Error Summary */}
        {operation.status === 'failed' && operation.errorSummary && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Operation Failed</p>
              <p className="text-xs text-muted-foreground mt-1">{operation.errorSummary}</p>
            </div>
          </div>
        )}

        {/* Rollback Button */}
        {isRollbackAvailable && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRollback}
              disabled={rollback.isPending}
              className="w-full"
            >
              {rollback.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rolling back...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Undo Changes (Rollback)
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Rollback available for 5 minutes after completion
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
