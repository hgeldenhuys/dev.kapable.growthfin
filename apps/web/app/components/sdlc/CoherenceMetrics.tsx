/**
 * SDLC Coherence Metrics Component
 * Displays coherence scores, trends, and violations
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useCoherenceMetrics } from "../../hooks/useSDLC";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Play, Loader2 } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { SkeletonLoader } from "./SkeletonLoader";
import { ErrorState } from "./ErrorState";
import { toast } from 'sonner';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CoherenceScore {
  name: string;
  value: number;
  threshold: number;
  description: string;
}

// Client-side code MUST use proxy routes


export function CoherenceMetrics() {
  const { latest, historical, isLoading, error, refetch } = useCoherenceMetrics();
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const handleRunCheck = async () => {
    setIsRunningCheck(true);
    try {
      const response = await fetch(`/api/v1/sdlc/coherence-check`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to run coherence check: ${response.statusText}`);
      }

      toast.success('Coherence check started', { description: 'The coherence check is running. Results will appear shortly.' });

      // Wait a bit for the check to complete, then refetch
      setTimeout(() => {
        refetch();
        setIsRunningCheck(false);
        toast.success('Coherence check complete', { description: 'The latest results are now available.' });
      }, 3000);
    } catch (err) {
      console.error('Error running coherence check:', err);
      toast.error('Failed to run coherence check', { description: err instanceof Error ? err.message : "An unknown error occurred" });
      setIsRunningCheck(false);
    }
  };

  if (isLoading) {
    return <SkeletonLoader variant="metrics" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Error Loading Coherence Metrics"
        message={error instanceof Error ? error.message : String(error)}
        onRetry={() => refetch()}
      />
    );
  }

  if (!latest) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <div className="text-center mb-6">
            <div className="text-muted-foreground mb-2">No coherence checks found</div>
            <div className="text-sm text-muted-foreground">
              Click "Run Check" to analyze project coherence
            </div>
          </div>
          <Button
            onClick={handleRunCheck}
            disabled={isRunningCheck}
            className="gap-2"
          >
            {isRunningCheck ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running Check...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Coherence Check
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Prefer latest if it has a meaningful score, otherwise use most recent historical
  const meaningfulLatest = latest && latest.overall > 0 ? latest : null;
  const fallbackHistorical = historical?.find(h => h.overall && h.overall > 0);
  const displayData = meaningfulLatest || fallbackHistorical || latest || {};

  // Extract metrics from nested structure if present
  const metrics = displayData.metrics || displayData;

  // Extract scores
  const scores: CoherenceScore[] = [
    {
      name: 'Vision Alignment',
      value: metrics.vision_alignment || 0,
      threshold: 0.8,
      description: 'How well components align with vision'
    },
    {
      name: 'Value Embodiment',
      value: metrics.value_embodiment || 0,
      threshold: 0.7,
      description: 'How well code embodies values'
    },
    {
      name: 'Purpose Clarity',
      value: metrics.purpose_clarity || 0,
      threshold: 0.7,
      description: 'How clear component purposes are'
    },
    {
      name: 'Causal Completeness',
      value: metrics.causal_completeness || 0,
      threshold: 0.75,
      description: 'How complete cause-effect understanding is'
    },
  ];

  const overallScore = displayData.overall || 0;
  const overallStatus = overallScore >= 0.75 ? 'healthy' : overallScore >= 0.65 ? 'warning' : 'critical';

  // Calculate trend safely
  const trend = (() => {
    if (!historical || historical.length < 2) return 0;

    const current = displayData.overall;
    const previous = historical.find(h => h.overall && h.overall > 0)?.overall;

    if (!current || !previous) return 0;

    return current - previous;
  })();

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card className={overallStatus === 'critical' ? 'border-destructive' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center justify-between">
                <span>Overall Coherence Score</span>
                {trend !== 0 && (
                  <div className="flex items-center gap-1">
                    {trend > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {(trend * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </CardTitle>
            </div>
            <Button
              onClick={handleRunCheck}
              disabled={isRunningCheck}
              variant="outline"
              size="sm"
              className="gap-2 ml-4"
            >
              {isRunningCheck ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Check
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            Latest check: {displayData.date ? new Date(displayData.date).toLocaleDateString() : 'Unknown'}
            {displayData !== meaningfulLatest && fallbackHistorical && (
              <Badge variant="secondary" className="ml-2">
                Most Recent (from {displayData.date ? new Date(displayData.date).toLocaleDateString() : 'Unknown'})
              </Badge>
            )}
            {displayData === meaningfulLatest && (
              <Badge variant="default" className="ml-2">
                Current
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overallScore === 0 && !fallbackHistorical ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Coherence Data</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {displayData?.status === 'FAIL'
                  ? 'Knowledge graph is empty. Add entities to generate coherence scores.'
                  : 'No coherence checks found. Click "Run Check" to analyze system coherence.'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="text-6xl font-bold">{(overallScore * 100).toFixed(0)}%</div>
                <div>
                  <Badge
                    variant={overallStatus === 'healthy' ? 'default' : overallStatus === 'warning' ? 'secondary' : 'destructive'}
                    className="mb-2"
                  >
                    {overallStatus === 'healthy' ? 'Healthy' : overallStatus === 'warning' ? 'Warning' : 'Critical'}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    Target: 75% minimum
                  </div>
                </div>
              </div>
              {displayData !== meaningfulLatest && fallbackHistorical && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <AlertCircle className="inline-block h-4 w-4 mr-1" />
                    Current knowledge graph is empty. Showing most recent meaningful check.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Individual Scores */}
      <div className="grid gap-4 md:grid-cols-2">
        {scores.map((score) => {
          const percentage = score.value * 100;
          const isHealthy = score.value >= score.threshold;
          const isWarning = score.value >= score.threshold - 0.1 && score.value < score.threshold;

          return (
            <Card key={score.name} className={!isHealthy && !isWarning ? 'border-destructive' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>{score.name}</span>
                  {isHealthy ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {score.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{percentage.toFixed(0)}%</span>
                    <Badge
                      variant={isHealthy ? 'default' : isWarning ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      Target: {(score.threshold * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        isHealthy ? 'bg-green-500' : isWarning ? 'bg-yellow-500' : 'bg-destructive'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Violations */}
      {latest.violations?.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Violations ({latest.violations.length})
            </CardTitle>
            <CardDescription>Issues that need to be addressed</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {latest.violations.map((violation: any, index: number) => (
                  <div
                    key={index}
                    className={`p-4 border rounded-lg ${
                      violation.severity === 'critical' ? 'border-destructive bg-destructive/5' :
                      violation.severity === 'high' ? 'border-orange-500 bg-orange-500/5' :
                      'border-yellow-500 bg-yellow-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium">{violation.type || 'Violation'}</div>
                      <Badge
                        variant={
                          violation.severity === 'critical' ? 'destructive' :
                          violation.severity === 'high' ? 'default' :
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {violation.severity || 'medium'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {violation.description || violation.message}
                    </div>
                    {violation.location && (
                      <div className="text-xs font-mono text-muted-foreground">
                        {violation.location}
                      </div>
                    )}
                    {violation.recommendation && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Recommendation:</span> {violation.recommendation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Historical Trend */}
      {(() => {
        // Only show checks with valid scores in chart
        const validChecks = historical?.filter(check => check.overall && check.overall > 0) || [];

        if (validChecks.length === 0) return null;

        // Sort by date in descending order (newest first)
        const sortedChecks = validChecks.slice().sort((a: any, b: any) => {
          const dateStrA = a.date;
          const dateStrB = b.date;

          // Handle invalid/null dates
          if (!dateStrA) return 1; // Push nulls to end
          if (!dateStrB) return -1;

          const dateA = new Date(dateStrA).getTime();
          const dateB = new Date(dateStrB).getTime();

          // Handle invalid dates (NaN)
          if (isNaN(dateA)) return 1;
          if (isNaN(dateB)) return -1;

          return dateB - dateA; // Newest first
        });

        return (
          <Card>
            <CardHeader>
              <CardTitle>Coherence Trend</CardTitle>
              <CardDescription>Last {sortedChecks.length} checks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedChecks.map((check: any, index: number) => {
                  const score = check.overall || 0;
                  const status = score >= 0.75 ? 'healthy' : score >= 0.65 ? 'warning' : 'critical';

                  return (
                    <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="text-sm text-muted-foreground w-40">
                        {check.date ? new Date(check.date).toLocaleDateString() : `Check ${index + 1}`}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{(score * 100).toFixed(0)}%</span>
                          <Badge
                            variant={status === 'healthy' ? 'default' : status === 'warning' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {status}
                          </Badge>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              status === 'healthy' ? 'bg-green-500' :
                              status === 'warning' ? 'bg-yellow-500' :
                              'bg-destructive'
                            }`}
                            style={{ width: `${Math.min(score * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      {check.violations && (
                        <div className="text-sm text-muted-foreground">
                          {check.violations.length} violation(s)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Full Report Viewer */}
      {displayData.content && (
        <Card>
          <CardHeader>
            <CardTitle>Full Coherence Report</CardTitle>
            <CardDescription>
              Report from {displayData.date ? new Date(displayData.date).toLocaleDateString() : 'Unknown date'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] w-full rounded-md border p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayData.content}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
