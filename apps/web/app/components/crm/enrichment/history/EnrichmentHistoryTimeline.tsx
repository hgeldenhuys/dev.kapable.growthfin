/**
 * EnrichmentHistoryTimeline Component
 * Timeline view of enrichment history using accordion
 */

import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import { Skeleton } from '~/components/ui/skeleton';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Calendar, AlertCircle } from 'lucide-react';
import { useEnrichmentHistory } from '~/hooks/useEnrichmentHistory';
import { EnrichmentHistoryEntry } from './EnrichmentHistoryEntry';
import { EnrichmentReportModal } from './EnrichmentReportModal';

interface EnrichmentHistoryTimelineProps {
  entityId: string;
  entityType: 'contact' | 'lead';
}

export function EnrichmentHistoryTimeline({
  entityId,
  entityType,
}: EnrichmentHistoryTimelineProps) {
  const { data, isLoading, error } = useEnrichmentHistory(entityId, entityType, {
    enableRealtime: true, // Enable SSE streaming
  });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load enrichment history: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data?.history?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          No enrichment history yet
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Enrichment history will appear here once enrichment tasks are completed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="w-full">
        {data.history.map((entry) => (
          <AccordionItem key={entry.id} value={entry.id}>
            <AccordionTrigger>
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
                <Badge variant="outline">
                  {entry.templateSnapshot?.name || 'Unknown Template'}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <EnrichmentHistoryEntry
                entryId={entry.id}
                status={entry.status}
                summary={entry.enrichmentSummary}
                changesSinceLast={entry.changesSinceLast}
                onViewReport={() => setSelectedEntryId(entry.id)}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Modal for full markdown report */}
      <EnrichmentReportModal
        entryId={selectedEntryId}
        open={!!selectedEntryId}
        onClose={() => setSelectedEntryId(null)}
      />
    </div>
  );
}
