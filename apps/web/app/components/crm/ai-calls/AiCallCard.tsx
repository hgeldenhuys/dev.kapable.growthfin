/**
 * AiCallCard Component (Phase J - AI Call History View)
 *
 * Displays a summary card for an AI voice call with outcome, sentiment,
 * duration, and key insights.
 */

import { Link } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';
import {
  Clock,
  ThumbsUp,
  ThumbsDown,
  Clock3,
  Voicemail,
  PhoneMissed,
  AlertCircle,
  Smile,
  Meh,
  Frown,
  Flame,
  Sun,
  Snowflake,
  Bot,
  PhoneIncoming,
  PhoneOutgoing,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

// Types based on schema
interface AiCallAnalysis {
  intent?: string;
  objections?: string[];
  nextSteps?: string[];
  leadQuality?: 'hot' | 'warm' | 'cold';
}

interface AiCall {
  id: string;
  conversationId: string;
  callOutcome: 'interested' | 'not_interested' | 'callback' | 'voicemail' | 'no_answer' | 'failed' | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  audioSeconds: number | null;
  cost: string | null;
  keyPoints: string[] | null;
  analysis: AiCallAnalysis | null;
  createdAt: string;
  direction?: 'inbound' | 'outbound' | null;
  callerIdentified?: boolean;
  callerPhoneNumber?: string | null;
  identifiedEntityType?: 'lead' | 'contact' | null;
}

interface AiCallCardProps {
  aiCall: AiCall;
  contactName?: string;
  scriptName?: string;
  workspaceId: string;
  className?: string;
}

/**
 * Format seconds to MM:SS
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Outcome badge configuration
 */
const OUTCOME_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  interested: { label: 'Interested', variant: 'default', icon: <ThumbsUp className="h-3 w-3" /> },
  not_interested: { label: 'Not Interested', variant: 'destructive', icon: <ThumbsDown className="h-3 w-3" /> },
  callback: { label: 'Callback', variant: 'secondary', icon: <Clock3 className="h-3 w-3" /> },
  voicemail: { label: 'Voicemail', variant: 'outline', icon: <Voicemail className="h-3 w-3" /> },
  no_answer: { label: 'No Answer', variant: 'outline', icon: <PhoneMissed className="h-3 w-3" /> },
  failed: { label: 'Failed', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
};

/**
 * Sentiment badge configuration
 */
const SENTIMENT_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  positive: { label: 'Positive', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <Smile className="h-3 w-3" /> },
  neutral: { label: 'Neutral', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400', icon: <Meh className="h-3 w-3" /> },
  negative: { label: 'Negative', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <Frown className="h-3 w-3" /> },
};

/**
 * Lead quality badge configuration
 */
const QUALITY_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  hot: { label: 'Hot', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <Flame className="h-3 w-3" /> },
  warm: { label: 'Warm', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: <Sun className="h-3 w-3" /> },
  cold: { label: 'Cold', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Snowflake className="h-3 w-3" /> },
};

export function AiCallCard({ aiCall, contactName, scriptName, workspaceId, className }: AiCallCardProps) {
  const outcomeConfig = aiCall.callOutcome ? OUTCOME_CONFIG[aiCall.callOutcome] : null;
  const sentimentConfig = aiCall.sentiment ? SENTIMENT_CONFIG[aiCall.sentiment] : null;
  const qualityConfig = aiCall.analysis?.leadQuality ? QUALITY_CONFIG[aiCall.analysis.leadQuality] : null;

  return (
    <Link to={`/dashboard/${workspaceId}/crm/ai-calls/${aiCall.id}`}>
      <Card className={cn('hover:shadow-md transition-shadow cursor-pointer', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{contactName || 'Unknown Contact'}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(aiCall.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {aiCall.direction === 'inbound' ? (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <PhoneIncoming className="h-3 w-3 mr-1" />
                  Inbound
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <PhoneOutgoing className="h-3 w-3 mr-1" />
                  Outbound
                </Badge>
              )}
              {scriptName && (
                <Badge variant="outline" className="text-xs">
                  {scriptName}
                </Badge>
              )}
            </div>
          </div>
          {/* Caller identification for inbound calls */}
          {aiCall.direction === 'inbound' && (
            <div className="text-xs mt-1">
              {aiCall.callerIdentified ? (
                <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Caller identified ({aiCall.identifiedEntityType})
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  Unknown caller{aiCall.callerPhoneNumber ? `: ${aiCall.callerPhoneNumber}` : ''}
                </span>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Badges Row */}
          <div className="flex flex-wrap gap-2">
            {outcomeConfig && (
              <Badge variant={outcomeConfig.variant} className="gap-1">
                {outcomeConfig.icon}
                {outcomeConfig.label}
              </Badge>
            )}
            {sentimentConfig && (
              <Badge variant="outline" className={cn('gap-1', sentimentConfig.className)}>
                {sentimentConfig.icon}
                {sentimentConfig.label}
              </Badge>
            )}
            {qualityConfig && (
              <Badge variant="outline" className={cn('gap-1', qualityConfig.className)}>
                {qualityConfig.icon}
                {qualityConfig.label}
              </Badge>
            )}
          </div>

          {/* Duration */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(aiCall.audioSeconds)}</span>
            </div>
            {aiCall.cost && (
              <div className="flex items-center gap-1">
                <span>${parseFloat(aiCall.cost).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Key Points Preview */}
          {aiCall.keyPoints && aiCall.keyPoints.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Key Points:</p>
              <ul className="text-sm space-y-1">
                {aiCall.keyPoints.slice(0, 2).map((point, i) => (
                  <li key={i} className="text-sm text-muted-foreground truncate">
                    • {point}
                  </li>
                ))}
                {aiCall.keyPoints.length > 2 && (
                  <li className="text-xs text-muted-foreground">
                    +{aiCall.keyPoints.length - 2} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Intent */}
          {aiCall.analysis?.intent && (
            <p className="text-xs text-muted-foreground truncate">
              <span className="font-medium">Intent:</span> {aiCall.analysis.intent}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default AiCallCard;
