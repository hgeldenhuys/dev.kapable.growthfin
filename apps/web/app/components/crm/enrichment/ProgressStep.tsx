/**
 * ProgressStep Component
 * Step 5: Monitor real-time batch job progress
 */

import { useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, DollarSign, AlertCircle } from 'lucide-react';
import type { EnrichmentJob } from '~/types/crm';

interface ProgressStepProps {
  job: EnrichmentJob | null;
  isLoading: boolean;
  onCancel: () => void;
  onComplete: () => void;
}

export function ProgressStep({ job, isLoading, onCancel, onComplete }: ProgressStepProps) {
  const isRunning = job?.status === 'running';
  const isCompleted = job?.status === 'completed';
  const isFailed = job?.status === 'failed';
  const isCancelled = job?.status === 'cancelled';

  const totalContacts = job?.totalContacts || 0;
  const progress = totalContacts > 0 ? ((job?.processedContacts || 0) / totalContacts) * 100 : 0;

  // Auto-advance when completed
  useEffect(() => {
    if (isCompleted) {
      const timer = setTimeout(() => {
        onComplete();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, onComplete]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          {isCompleted
            ? 'Enrichment Complete'
            : isFailed
              ? 'Enrichment Failed'
              : isCancelled
                ? 'Enrichment Cancelled'
                : 'Running Enrichment'}
        </h2>
        <p className="text-muted-foreground mt-1">
          {isCompleted
            ? 'All contacts have been enriched successfully'
            : isFailed
              ? 'The enrichment job encountered an error'
              : isCancelled
                ? 'The enrichment job was cancelled'
                : 'Processing contacts with AI enrichment...'}
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : job ? (
        <div className="space-y-6">
          {/* Progress Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : isFailed ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {job.name}
              </CardTitle>
              <CardDescription>Job ID: {job.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{job.totalContacts}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Processed</p>
                  <p className="text-2xl font-bold text-green-600">{job.processedContacts}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-destructive">{job.failedContacts}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Cost</p>
                  <p className="text-2xl font-bold flex items-center gap-1">
                    <DollarSign className="h-5 w-5" />
                    {job.actualCost ? parseFloat(job.actualCost).toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>

              {/* Time Info */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="text-sm font-medium">
                    {job.startedAt
                      ? new Date(job.startedAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
                {job.completedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-sm font-medium">
                      {new Date(job.completedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error Alert */}
          {isFailed && job.failureReason && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{job.failureReason}</AlertDescription>
            </Alert>
          )}

          {/* Budget Warning */}
          {job.budgetLimit &&
            job.actualCost &&
            parseFloat(job.actualCost) > parseFloat(job.budgetLimit) * 0.8 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Warning: Actual cost is approaching budget limit (${job.budgetLimit})
                </AlertDescription>
              </Alert>
            )}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex justify-end">
        {isRunning ? (
          <Button variant="destructive" onClick={onCancel}>
            Cancel Job
          </Button>
        ) : isCompleted ? (
          <Button onClick={onComplete} size="lg">
            View Results
          </Button>
        ) : null}
      </div>
    </div>
  );
}
