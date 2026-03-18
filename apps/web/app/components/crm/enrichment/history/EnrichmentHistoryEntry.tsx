/**
 * EnrichmentHistoryEntry Component
 * Shows summary of enrichment entry within accordion item
 */

import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { FileText, Loader2 } from 'lucide-react';

interface EnrichmentHistoryEntryProps {
  entryId: string;
  status?: 'pending' | 'completed' | 'failed';
  summary?: string | null;
  changesSinceLast?: string | null;
  onViewReport: () => void;
}

export function EnrichmentHistoryEntry({
  status,
  summary,
  changesSinceLast,
  onViewReport,
}: EnrichmentHistoryEntryProps) {
  return (
    <div className="space-y-3 py-2">
      {status === 'pending' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Enrichment in progress...</span>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <span>Enrichment failed</span>
        </div>
      )}

      {summary && (
        <div>
          <Label className="text-xs text-muted-foreground">Summary</Label>
          <p className="text-sm mt-1">{summary}</p>
        </div>
      )}

      {changesSinceLast && (
        <div>
          <Label className="text-xs text-muted-foreground">Changes Since Last</Label>
          <p className="text-sm mt-1 text-orange-600 dark:text-orange-400">
            {changesSinceLast}
          </p>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onViewReport} className="w-full">
        <FileText className="h-4 w-4 mr-2" />
        View Full Report
      </Button>
    </div>
  );
}
