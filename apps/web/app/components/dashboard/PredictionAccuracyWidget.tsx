/**
 * PredictionAccuracyWidget Component
 * Dashboard widget showing prediction model accuracy and stats
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Brain, Target, TrendingUp, Clock } from 'lucide-react';
import { getModelAccuracyColor } from '~/hooks/useLeadPrediction';

interface PredictionStats {
  current_accuracy: number;
  predictions_this_month: number;
  high_score_leads: number;
  model_last_trained: string;
}

interface PredictionAccuracyWidgetProps {
  stats: PredictionStats | null;
  isLoading?: boolean;
  className?: string;
}

export function PredictionAccuracyWidget({
  stats,
  isLoading = false,
  className,
}: PredictionAccuracyWidgetProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Prediction Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Prediction Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No prediction model trained yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Prediction Model
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" />
              <span className="text-sm">Accuracy</span>
            </div>
            <Badge className={getModelAccuracyColor(stats.current_accuracy)}>
              {Math.round(stats.current_accuracy * 100)}%
            </Badge>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Predictions</span>
            </div>
            <p className="text-2xl font-bold">{stats.predictions_this_month}</p>
            <p className="text-xs text-muted-foreground">this month</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" />
              <span className="text-sm">High Score Leads</span>
            </div>
            <p className="text-2xl font-bold">{stats.high_score_leads}</p>
            <p className="text-xs text-muted-foreground">score 70+</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Last Trained</span>
            </div>
            <p className="text-sm font-semibold">
              {new Date(stats.model_last_trained).toLocaleDateString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
