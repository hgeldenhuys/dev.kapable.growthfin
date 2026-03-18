/**
 * EnrichmentHistoryPanel Component
 * Timeline of enrichment events showing what changed, when, and source
 */

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Clock, Database, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '~/lib/utils';
import { formatEnrichedValue, getConfidenceLabel } from '~/hooks/useLeadEnrichment';

interface EnrichmentEvent {
  id: string;
  timestamp: string;
  status: 'completed' | 'failed';
  source: string;
  fields_updated: string[];
  enriched_fields?: Record<string, any>;
  confidence_scores?: Record<string, number>;
  error_message?: string;
}

interface EnrichmentHistoryPanelProps {
  events: EnrichmentEvent[];
  className?: string;
}

export function EnrichmentHistoryPanel({
  events,
  className,
}: EnrichmentHistoryPanelProps) {
  if (!events || events.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Enrichment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No enrichment history available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Enrichment History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, idx) => (
            <div
              key={event.id}
              className={cn(
                'relative pl-6 pb-4',
                idx !== events.length - 1 && 'border-l-2 border-border'
              )}
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute left-0 top-0 -ml-[9px] h-4 w-4 rounded-full border-2 bg-background',
                  event.status === 'completed'
                    ? 'border-green-500'
                    : 'border-red-500'
                )}
              >
                {event.status === 'completed' ? (
                  <CheckCircle2 className="h-3 w-3 -ml-[1px] -mt-[1px] text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 -ml-[1px] -mt-[1px] text-red-500" />
                )}
              </div>

              {/* Event content */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {event.status === 'completed'
                        ? 'Enrichment Completed'
                        : 'Enrichment Failed'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Database className="h-3 w-3" />
                    {event.source}
                  </Badge>
                </div>

                {event.status === 'completed' && event.enriched_fields && (
                  <div className="mt-3 space-y-2">
                    {event.fields_updated.map((field) => {
                      const fieldData = event.enriched_fields?.[field];
                      const confidence = event.confidence_scores?.[field];

                      return (
                        <div
                          key={field}
                          className="text-xs bg-muted/50 rounded p-2"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold capitalize">
                              {field.replace(/_/g, ' ')}
                            </span>
                            {confidence && (
                              <Badge variant="outline" className="text-xs h-5">
                                {getConfidenceLabel(confidence)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            {formatEnrichedValue(fieldData?.value || fieldData)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {event.status === 'failed' && event.error_message && (
                  <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
                    {event.error_message}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
