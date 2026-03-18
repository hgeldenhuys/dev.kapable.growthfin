/**
 * ScoringModelConfig Component
 * Configure scoring model weights for workspace
 */

import { useState } from 'react';
import { Save, RotateCcw, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Slider } from '~/components/ui/slider';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { useScoringModels, useUpdateScoringModel } from '~/hooks/useLeadScoring';
import { toast } from 'sonner';
import { cn } from '~/lib/utils';

interface ScoringModelConfigProps {
  workspaceId: string;
  className?: string;
}

export function ScoringModelConfig({
  workspaceId,
  className,
}: ScoringModelConfigProps) {
  const { data: modelsData } = useScoringModels(workspaceId);
  const updateModel = useUpdateScoringModel();
  // Get the active composite model
  const activeModel = modelsData?.models.find(
    (m: any) => m.model_type === 'composite' && m.is_active
  );

  const [propensityWeight, setPropensityWeight] = useState(
    activeModel?.propensity_weight ? activeModel.propensity_weight * 100 : 40
  );
  const [engagementWeight, setEngagementWeight] = useState(
    activeModel?.engagement_weight ? activeModel.engagement_weight * 100 : 30
  );
  const [fitWeight, setFitWeight] = useState(
    activeModel?.fit_weight ? activeModel.fit_weight * 100 : 30
  );

  // Calculate total weight
  const totalWeight = propensityWeight + engagementWeight + fitWeight;
  const isValid = Math.abs(totalWeight - 100) < 1;

  // Adjust weights to sum to 100
  const normalizeWeights = () => {
    const scale = 100 / totalWeight;
    setPropensityWeight(Math.round(propensityWeight * scale));
    setEngagementWeight(Math.round(engagementWeight * scale));
    setFitWeight(100 - Math.round(propensityWeight * scale) - Math.round(engagementWeight * scale));
  };

  const handleReset = () => {
    if (activeModel) {
      setPropensityWeight(Math.round((activeModel.propensity_weight || 0.4) * 100));
      setEngagementWeight(Math.round((activeModel.engagement_weight || 0.3) * 100));
      setFitWeight(Math.round((activeModel.fit_weight || 0.3) * 100));
    } else {
      setPropensityWeight(40);
      setEngagementWeight(30);
      setFitWeight(30);
    }
  };

  const handleSave = async () => {
    if (!activeModel) {
      toast.error('Error', { description: 'No active scoring model found' });
      return;
    }

    if (!isValid) {
      normalizeWeights();
      toast.success('Weights adjusted', { description: 'Weights have been normalized to sum to 100%' });
      return;
    }

    try {
      await updateModel.mutateAsync({
        workspaceId,
        modelId: activeModel.id,
        data: {
          propensity_weight: propensityWeight / 100,
          engagement_weight: engagementWeight / 100,
          fit_weight: fitWeight / 100,
        },
      });

      toast.success('Model updated', { description: 'Scoring weights have been updated. Lead scores will be recalculated.' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  if (!activeModel) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No scoring model configured</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Scoring Model Configuration</CardTitle>
        <CardDescription>
          Adjust the weights for each scoring dimension. Weights must sum to 100%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Propensity Weight */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Propensity Weight</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>AI-predicted likelihood to convert based on historical patterns</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-2xl font-bold tabular-nums">{propensityWeight}%</span>
          </div>
          <Slider
            value={[propensityWeight]}
            onValueChange={([value]) => setPropensityWeight(value)}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Engagement Weight */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Engagement Weight</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Recent activity and interaction levels (last 30 days)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-2xl font-bold tabular-nums">{engagementWeight}%</span>
          </div>
          <Slider
            value={[engagementWeight]}
            onValueChange={([value]) => setEngagementWeight(value)}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Fit Weight */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Fit Weight</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Match with ideal customer profile (ICP)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-2xl font-bold tabular-nums">{fitWeight}%</span>
          </div>
          <Slider
            value={[fitWeight]}
            onValueChange={([value]) => setFitWeight(value)}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        {/* Total Weight Indicator */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Total Weight</span>
            <span
              className={cn(
                'text-2xl font-bold tabular-nums',
                isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              {totalWeight}%
            </span>
          </div>

          {!isValid && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Invalid Configuration</AlertTitle>
              <AlertDescription>
                Weights must sum to 100%. Current total: {totalWeight}%
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          {!isValid && (
            <Button
              variant="secondary"
              onClick={normalizeWeights}
              className="flex-1"
            >
              Normalize to 100%
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={updateModel.isPending}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateModel.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Changing these weights will trigger a recalculation of all lead scores in this workspace.
            This process may take a few minutes.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function AlertCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
