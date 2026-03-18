/**
 * HealthFactorsPanel Component
 * Breakdown of health score factors and risk indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Progress } from '~/components/ui/progress';
import { Badge } from '~/components/ui/badge';
import { Loader2, Heart, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useHealthScore, getFactorScoreColor } from '~/hooks/useHealthScore';

interface HealthFactorsPanelProps {
  leadId: string;
  workspaceId: string;
}

export function HealthFactorsPanel({ leadId, workspaceId }: HealthFactorsPanelProps) {
  const { data: healthData, isLoading, error } = useHealthScore(leadId, workspaceId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">Failed to load health factors</p>
        </CardContent>
      </Card>
    );
  }

  if (!healthData) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Heart className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No health data available yet</p>
        </CardContent>
      </Card>
    );
  }

  const { factors, positive_factors, risk_factors } = healthData;

  const factorLabels = {
    engagement_score: 'Engagement',
    responsiveness_score: 'Responsiveness',
    activity_score: 'Activity Level',
    relationship_score: 'Relationship Strength',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Health Factors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Factor Scores */}
        <div className="space-y-4">
          {factors && Object.entries(factors).map(([key, value]) => {
            const label = factorLabels[key as keyof typeof factorLabels] || key;
            const score = Math.round(value);

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{label}</span>
                  <span className={`text-sm font-semibold ${getFactorScoreColor(score)}`}>
                    {score}/100
                  </span>
                </div>
                <Progress value={score} className="h-2" />
              </div>
            );
          })}
        </div>

        {/* Positive Factors */}
        {positive_factors && positive_factors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium">Positive Factors</span>
            </div>
            <div className="space-y-1">
              {positive_factors.map((factor, index) => (
                <div
                  key={index}
                  className="text-sm bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded p-2"
                >
                  <CheckCircle2 className="inline h-3 w-3 mr-1 text-green-600 dark:text-green-400" />
                  {typeof factor === 'string' ? factor : factor.description || factor.factor}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {risk_factors && risk_factors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-medium">Risk Factors</span>
            </div>
            <div className="space-y-1">
              {risk_factors.map((factor, index) => (
                <div
                  key={index}
                  className="text-sm bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded p-2"
                >
                  <AlertCircle className="inline h-3 w-3 mr-1 text-orange-600 dark:text-orange-400" />
                  {typeof factor === 'string' ? factor : factor.description || factor.factor}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {healthData.recommended_actions && healthData.recommended_actions.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <span className="text-sm font-medium">Recommended Actions</span>
            <div className="space-y-1">
              {healthData.recommended_actions.map((action, index) => (
                <div key={index} className="text-sm text-muted-foreground">
                  • {action}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
