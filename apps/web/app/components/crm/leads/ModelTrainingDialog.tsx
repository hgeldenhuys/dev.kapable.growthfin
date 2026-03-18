/**
 * ModelTrainingDialog Component
 * Dialog to trigger model training with progress and metrics display
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, Brain } from 'lucide-react';
import { useTrainModel, usePredictionModels, getModelAccuracyColor } from '~/hooks/useLeadPrediction';

interface ModelTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function ModelTrainingDialog({
  open,
  onOpenChange,
  workspaceId,
}: ModelTrainingDialogProps) {
  const trainMutation = useTrainModel();
  const { data: models } = usePredictionModels(workspaceId);

  const activeModel = models?.find((m) => m.is_active);

  const handleTrain = () => {
    trainMutation.mutate({
      workspaceId,
      modelType: 'conversion',
      minSamples: 100,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Train Prediction Model
          </DialogTitle>
          <DialogDescription>
            Train a new AI model to predict lead conversion probability based on
            historical data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Model Info */}
          {activeModel && (
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Current Model</p>
                <Badge variant="outline">Active</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Version</p>
                  <p className="font-medium">{activeModel.model_version}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Algorithm</p>
                  <p className="font-medium capitalize">
                    {activeModel.algorithm.replace(/_/g, ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Training Samples</p>
                  <p className="font-medium">{activeModel.training_samples}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Accuracy</p>
                  <Badge className={getModelAccuracyColor(activeModel.accuracy || 0)}>
                    {Math.round((activeModel.accuracy || 0) * 100)}%
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Trained: {new Date(activeModel.training_completed_at || activeModel.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Training Status */}
          {trainMutation.isPending && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-semibold">Training in progress...</p>
              </div>
              <Progress value={50} className="h-2" />
              <p className="text-xs text-muted-foreground">
                This may take several minutes. You can close this dialog and continue working.
              </p>
            </div>
          )}

          {trainMutation.isSuccess && (
            <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2 bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  Training Completed
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                New model is now active and being used for predictions.
              </p>
            </div>
          )}

          {trainMutation.isError && (
            <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-2 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  Training Failed
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {trainMutation.error?.message || 'An error occurred during training'}
              </p>
            </div>
          )}

          {/* Training Requirements */}
          {!trainMutation.isPending && !trainMutation.isSuccess && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold">Training Requirements:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Minimum 100 historical leads</li>
                <li>At least 10 converted leads</li>
                <li>Training takes 2-5 minutes</li>
                <li>Previous model will be replaced</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {trainMutation.isSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!trainMutation.isSuccess && (
            <Button
              onClick={handleTrain}
              disabled={trainMutation.isPending}
            >
              {trainMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Training...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Train New Model
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
