/**
 * Predictions Management Page
 * Manage prediction models, view performance metrics, and train new models
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Brain, TrendingUp, Clock, Users } from 'lucide-react';
import { ModelTrainingDialog } from '~/components/crm/leads/ModelTrainingDialog';
import { useWorkspaceId } from '~/hooks/useWorkspace';
import { usePredictionModels, getModelAccuracyColor } from '~/hooks/useLeadPrediction';
import { CrmErrorBoundary } from '~/components/crm/CrmErrorBoundary';

export default function PredictionsPage() {
  const workspaceId = useWorkspaceId();
  const { data: models, isLoading } = usePredictionModels(workspaceId);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);

  const activeModel = models?.find((m) => m.is_active);
  const historicalModels = models?.filter((m) => !m.is_active) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading models...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prediction Models</h1>
          <p className="text-muted-foreground">
            Manage AI models for lead conversion prediction
          </p>
        </div>
        <Button onClick={() => setTrainingDialogOpen(true)}>
          <Brain className="mr-2 h-4 w-4" />
          Train New Model
        </Button>
      </div>

      {/* Active Model */}
      {activeModel ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Active Model
              </CardTitle>
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Model Version</p>
                <p className="text-2xl font-bold">{activeModel.model_version}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Algorithm</p>
                <p className="text-lg font-semibold capitalize">
                  {activeModel.algorithm.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Accuracy</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <Badge className={getModelAccuracyColor(activeModel.accuracy || 0)}>
                    {Math.round((activeModel.accuracy || 0) * 100)}%
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Training Samples</p>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <p className="text-lg font-semibold">{activeModel.training_samples}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Precision</p>
                <p className="text-xl font-bold">
                  {activeModel.precision ? Math.round(activeModel.precision * 100) : 0}%
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Recall</p>
                <p className="text-xl font-bold">
                  {activeModel.recall ? Math.round(activeModel.recall * 100) : 0}%
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">F1 Score</p>
                <p className="text-xl font-bold">
                  {activeModel.f1_score ? Math.round(activeModel.f1_score * 100) : 0}%
                </p>
              </div>
            </div>

            <div className="mt-6 border-t pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Trained: {new Date(activeModel.training_completed_at || activeModel.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Model</h3>
            <p className="text-muted-foreground mb-4">
              Train your first prediction model to start predicting lead conversions.
            </p>
            <Button onClick={() => setTrainingDialogOpen(true)}>
              <Brain className="mr-2 h-4 w-4" />
              Train Model
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Historical Models */}
      {historicalModels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Training History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {historicalModels.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between border rounded-lg p-4"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-semibold">{model.model_version}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(model.training_completed_at || model.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Accuracy</p>
                      <Badge className={getModelAccuracyColor(model.accuracy || 0)}>
                        {Math.round((model.accuracy || 0) * 100)}%
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Samples</p>
                      <p className="font-semibold">{model.training_samples}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Training Dialog */}
      <ModelTrainingDialog
        open={trainingDialogOpen}
        onOpenChange={setTrainingDialogOpen}
        workspaceId={workspaceId}
      />
    </div>
  );
}

export { CrmErrorBoundary as ErrorBoundary };
