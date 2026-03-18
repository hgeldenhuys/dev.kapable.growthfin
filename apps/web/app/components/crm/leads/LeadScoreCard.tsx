/**
 * LeadScoreCard Component
 * Displays multi-dimensional lead scoring with composite score,
 * dimension breakdown, and detailed score explanations
 */

import { useState } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, TrendingUp, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { useLeadScores, useRecalculateScores } from '~/hooks/useLeadScoring';
import { toast } from 'sonner';
import { ScoreHistoryChart } from '../ScoreHistoryChart';
import { cn } from '~/lib/utils';

interface LeadScoreCardProps {
  leadId: string;
  workspaceId: string;
  showHistory?: boolean;
  className?: string;
}

export function LeadScoreCard({
  leadId,
  workspaceId,
  showHistory = true,
  className,
}: LeadScoreCardProps) {
  const { data: scoreData, isLoading, refetch } = useLeadScores(leadId, workspaceId);
  const recalculate = useRecalculateScores();
  const [engagementOpen, setEngagementOpen] = useState(false);
  const [fitOpen, setFitOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleRefresh = async () => {
    try {
      await recalculate.mutateAsync({ workspaceId, leadId });
      await refetch();
      toast.success('Scores refreshed', { description: 'Lead scores have been recalculated.' });
    } catch (error) {
      toast.error('Error', { description: String(error) });
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!scoreData) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No scoring data available</p>
        </CardContent>
      </Card>
    );
  }

  const { scores, breakdown, calculated_at, history } = scoreData;

  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score === 0) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressColor = (score: number) => {
    if (score === 0) return 'bg-muted-foreground/30';
    if (score >= 80) return 'bg-green-600';
    if (score >= 60) return 'bg-yellow-600';
    if (score >= 40) return 'bg-orange-600';
    return 'bg-red-600';
  };

  // Calculate time ago
  const timeAgo = (date: string) => {
    if (!date || isNaN(new Date(date).getTime())) return 'Not available';
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Lead Score</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="font-semibold mb-2">Score Calculation:</p>
                <ul className="space-y-1 text-sm">
                  <li>Propensity: AI-predicted likelihood to convert</li>
                  <li>Engagement: Recent activity and interactions</li>
                  <li>Fit: Match with ideal customer profile</li>
                  <li>Composite: Weighted average of all dimensions</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Composite Score */}
        <div className="flex flex-col items-center justify-center py-4">
          <div className="text-sm text-muted-foreground mb-2">Composite Score</div>
          <div className={cn('text-6xl font-bold tabular-nums', getScoreColor(scores.composite))}>
            {scores.composite}
          </div>
          <div className="text-sm text-muted-foreground mt-1">out of 100</div>
        </div>

        {/* Score Breakdown */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Score Breakdown</h4>

          {/* Propensity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Propensity</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>AI-predicted likelihood to convert based on historical patterns</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className={cn('font-semibold', getScoreColor(scores.propensity))}>
                {scores.propensity} <span className="text-muted-foreground text-xs">(40%)</span>
              </span>
            </div>
            <Progress value={scores.propensity} indicatorClassName={getProgressColor(scores.propensity)} />
          </div>

          {/* Engagement */}
          <Collapsible open={engagementOpen} onOpenChange={setEngagementOpen}>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                      <span className="font-medium">Engagement</span>
                      {engagementOpen ? (
                        <ChevronUp className="h-4 w-4 ml-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Recent activity and interaction levels (last 30 days)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className={cn('font-semibold', getScoreColor(scores.engagement))}>
                  {scores.engagement} <span className="text-muted-foreground text-xs">(30%)</span>
                </span>
              </div>
              <Progress value={scores.engagement} indicatorClassName={getProgressColor(scores.engagement)} />
              <CollapsibleContent>
                <div className="mt-3 space-y-2 pl-4 border-l-2 border-muted">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Email Opens</span>
                    <span className="font-medium">{breakdown.engagement.email_opens} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Email Clicks</span>
                    <span className="font-medium">{breakdown.engagement.email_clicks} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Website Visits</span>
                    <span className="font-medium">{breakdown.engagement.website_visits} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Recent Activities</span>
                    <span className="font-medium">{breakdown.engagement.activities} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>{breakdown.engagement.total} / 100</span>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Fit */}
          <Collapsible open={fitOpen} onOpenChange={setFitOpen}>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                      <span className="font-medium">Fit</span>
                      {fitOpen ? (
                        <ChevronUp className="h-4 w-4 ml-1" />
                      ) : (
                        <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Match with ideal customer profile (ICP)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className={cn('font-semibold', getScoreColor(scores.fit))}>
                  {scores.fit} <span className="text-muted-foreground text-xs">(30%)</span>
                </span>
              </div>
              <Progress value={scores.fit} indicatorClassName={getProgressColor(scores.fit)} />
              <CollapsibleContent>
                <div className="mt-3 space-y-2 pl-4 border-l-2 border-muted">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Company Size Match</span>
                    <span className="font-medium">{breakdown.fit.company_size_match} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Industry Match</span>
                    <span className="font-medium">{breakdown.fit.industry_match} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Revenue Match</span>
                    <span className="font-medium">{breakdown.fit.revenue_match} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Geography Match</span>
                    <span className="font-medium">{breakdown.fit.geo_match} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>{breakdown.fit.total} / 100</span>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        {/* Score History */}
        {showHistory && history && history.length > 0 && (
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <div className="space-y-4">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {historyOpen ? 'Hide' : 'View'} Score History
                  {historyOpen ? (
                    <ChevronUp className="h-4 w-4 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-2" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScoreHistoryChart leadId={leadId} workspaceId={workspaceId} days={30} />
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-xs text-muted-foreground">
            Last updated: {timeAgo(calculated_at)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={recalculate.isPending}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', recalculate.isPending && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
