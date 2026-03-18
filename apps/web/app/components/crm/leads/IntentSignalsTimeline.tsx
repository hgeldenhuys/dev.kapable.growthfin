/**
 * IntentSignalsTimeline Component
 * Timeline display of detected intent signals for a lead
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Loader2, Activity } from 'lucide-react';
import { useIntentScore, formatSignalType, getSignalIcon } from '~/hooks/useIntentScore';
import { cn } from '~/lib/utils';
import * as Icons from 'lucide-react';

interface IntentSignalsTimelineProps {
  leadId: string;
  workspaceId: string;
}

export function IntentSignalsTimeline({ leadId, workspaceId }: IntentSignalsTimelineProps) {
  const { data: intentData, isLoading, error } = useIntentScore(leadId, workspaceId);

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
          <p className="text-sm text-destructive">Failed to load intent signals</p>
        </CardContent>
      </Card>
    );
  }

  if (!intentData || !intentData.signals || intentData.signals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No intent signals detected yet</p>
        </CardContent>
      </Card>
    );
  }

  // Sort signals by most recent first
  const sortedSignals = [...intentData.signals].sort(
    (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Intent Signals</span>
          <Badge variant="secondary">{sortedSignals.length} signals</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedSignals.map((signal, index) => {
            // Get icon component dynamically
            const iconName = getSignalIcon(signal.signal_type);
            const IconComponent = (Icons as any)[iconName] || Activity;

            // Confidence color
            const confidenceColor =
              signal.confidence >= 0.8
                ? 'text-green-600 dark:text-green-400'
                : signal.confidence >= 0.6
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-orange-600 dark:text-orange-400';

            return (
              <div
                key={signal.id}
                className={cn(
                  'relative pl-6 pb-4',
                  index !== sortedSignals.length - 1 && 'border-l-2 border-muted'
                )}
              >
                {/* Timeline dot with icon */}
                <div className="absolute left-0 top-1 -translate-x-1/2 h-6 w-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center">
                  <IconComponent className="h-3 w-3 text-primary" />
                </div>

                <div className="space-y-2">
                  {/* Signal type and timestamp */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">
                      {formatSignalType(signal.signal_type)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(signal.detected_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Source and confidence */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Source: {signal.source}</span>
                    <span className={confidenceColor}>
                      Confidence: {Math.round(signal.confidence * 100)}%
                    </span>
                  </div>

                  {/* Signal data (if available) */}
                  {signal.signal_data && Object.keys(signal.signal_data).length > 0 && (
                    <div className="text-xs bg-muted/50 rounded p-2 space-y-1">
                      {Object.entries(signal.signal_data).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-semibold capitalize">
                            {key.replace(/_/g, ' ')}:
                          </span>{' '}
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
