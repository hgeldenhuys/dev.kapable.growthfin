/**
 * AIIntelligenceSection Component
 * Display AI propensity score and intelligence in lead screen pop
 */

import { TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Progress } from '~/components/ui/progress';
import { Badge } from '~/components/ui/badge';
import type { LeadDetailAIIntelligence } from '~/hooks/useLeadDetail';

interface AIIntelligenceSectionProps {
  ai: LeadDetailAIIntelligence;
}

export function AIIntelligenceSection({ ai }: AIIntelligenceSectionProps) {
  // Color coding based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600 dark:text-red-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Hot';
    if (score >= 50) return 'Warm';
    return 'Cool';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          AI Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Propensity Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Propensity Score</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold text-2xl ${getScoreColor(ai.propensityScore)}`}>
                {ai.propensityScore}
              </span>
              <span className="text-muted-foreground">/100</span>
              <Badge variant="outline" className={getScoreColor(ai.propensityScore)}>
                {getScoreLabel(ai.propensityScore)}
              </Badge>
            </div>
          </div>
          <Progress value={ai.propensityScore} className="h-2" />
        </div>

        {/* Score Factors */}
        {ai.scoreFactors && ai.scoreFactors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Key Factors:</p>
            <div className="flex flex-wrap gap-2">
              {ai.scoreFactors.map((factor, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  {factor.factor}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Business Intelligence */}
        {ai.businessIntelligence && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              {ai.businessIntelligence}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
