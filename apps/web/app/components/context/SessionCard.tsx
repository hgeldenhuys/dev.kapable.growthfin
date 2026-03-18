/**
 * SessionCard Component
 * US-CTX-008: Session List with Progress Indicators
 *
 * Displays individual session with progress bar, color-coded by usage threshold
 */

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Activity, Clock, Database } from "lucide-react";

interface SessionMetrics {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  percentageUsed: number;
}

interface SessionCardProps {
  sessionId: string;
  projectId: string;
  lastActivity: string;
  metrics: SessionMetrics;
  conversationTurns: number;
}

const TOKEN_LIMIT = 200000; // 200k token limit

function getColorByThreshold(percentage: number): {
  color: string;
  bgColor: string;
  textColor: string;
} {
  if (percentage >= 90) {
    return {
      color: "bg-red-500",
      bgColor: "bg-red-100 dark:bg-red-950",
      textColor: "text-red-700 dark:text-red-300"
    };
  }
  if (percentage >= 75) {
    return {
      color: "bg-yellow-500",
      bgColor: "bg-yellow-100 dark:bg-yellow-950",
      textColor: "text-yellow-700 dark:text-yellow-300"
    };
  }
  return {
    color: "bg-green-500",
    bgColor: "bg-green-100 dark:bg-green-950",
    textColor: "text-green-700 dark:text-green-300"
  };
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

export function SessionCard({
  sessionId,
  projectId,
  lastActivity,
  metrics,
  conversationTurns
}: SessionCardProps) {
  const { color, bgColor, textColor } = getColorByThreshold(metrics.percentageUsed);
  const truncatedSessionId = sessionId.substring(0, 8);
  const formattedTotal = formatTokens(metrics.totalTokens);
  const formattedLimit = formatTokens(TOKEN_LIMIT);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-mono flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {truncatedSessionId}...
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}
            </div>
          </div>
          <Badge variant="outline" className={`${bgColor} ${textColor} border-0`}>
            {metrics.percentageUsed.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Token Usage</span>
            <span className="font-mono font-medium">
              {formattedTotal} / {formattedLimit}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              className={`h-full transition-all ${color}`}
              style={{ width: `${Math.min(metrics.percentageUsed, 100)}%` }}
            />
          </div>
        </div>

        {/* Token Breakdown */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">Input</span>
            <span className="font-mono font-medium">{formatTokens(metrics.inputTokens)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">Output</span>
            <span className="font-mono font-medium">{formatTokens(metrics.outputTokens)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <Database className="h-3 w-3" />
              Cached
            </span>
            <span className="font-mono font-medium">{formatTokens(metrics.cachedTokens)}</span>
          </div>
        </div>

        {/* Session Metadata */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <span>Project: {projectId.substring(0, 8)}...</span>
          <span>{conversationTurns} turn{conversationTurns !== 1 ? 's' : ''}</span>
        </div>
      </CardContent>
    </Card>
  );
}
