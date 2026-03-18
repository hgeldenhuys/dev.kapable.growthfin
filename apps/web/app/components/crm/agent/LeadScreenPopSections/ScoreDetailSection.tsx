/**
 * ScoreDetailSection Component
 * Enhanced propensity score section for lead screen pop
 *
 * Features:
 * - Large circular gauge
 * - Detailed breakdown table
 * - 7-day history chart
 * - Manual refresh button
 * - Real-time updates via SSE
 */

import { useState } from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { ScoreGauge } from '~/components/crm/ScoreGauge';
import { ScoreBreakdownTable } from '~/components/crm/ScoreBreakdownTable';
import { ScoreHistoryChart } from '~/components/crm/ScoreHistoryChart';
import { toast } from 'sonner';

interface ScoreDetailSectionProps {
  leadId: string;
  workspaceId: string;
  score: number;
  scoreBreakdown: any; // ScoreBreakdown type
  scoreUpdatedAt: string | null;
}

export function ScoreDetailSection({
  leadId,
  workspaceId,
  score,
  scoreBreakdown,
  scoreUpdatedAt,
}: ScoreDetailSectionProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefreshScore = async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch(
        `/api/v1/crm/leads/${leadId}/recalculate-score?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to recalculate score');
      }

      toast.success('Score recalculated', { description: 'The propensity score has been updated successfully.' });
    } catch (error) {
      toast.error('Error', { description: 'Failed to recalculate score. Please try again.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Propensity Score
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshScore}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        {scoreUpdatedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(scoreUpdatedAt).toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Overview Tab - Gauge */}
          <TabsContent value="overview" className="space-y-4">
            <div className="flex justify-center py-6">
              <ScoreGauge score={score} size="lg" showLabel={true} />
            </div>

            {/* Quick summary */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Contact Quality</p>
                <p className="text-lg font-semibold">
                  {scoreBreakdown?.components?.contactQuality?.score || 0}/25
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Company Fit</p>
                <p className="text-lg font-semibold">
                  {scoreBreakdown?.components?.companyFit?.score || 0}/25
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Engagement</p>
                <p className="text-lg font-semibold">
                  {scoreBreakdown?.components?.engagement?.score || 0}/25
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Timing</p>
                <p className="text-lg font-semibold">
                  {scoreBreakdown?.components?.timing?.score || 0}/25
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Breakdown Tab - Table */}
          <TabsContent value="breakdown" className="space-y-4">
            {scoreBreakdown ? (
              <ScoreBreakdownTable breakdown={scoreBreakdown} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No breakdown data available
              </p>
            )}
          </TabsContent>

          {/* History Tab - Chart */}
          <TabsContent value="history" className="space-y-4">
            <ScoreHistoryChart leadId={leadId} workspaceId={workspaceId} days={7} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
