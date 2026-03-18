/**
 * EnrichmentPreviewModal Component
 * Modal showing enrichment data before applying with side-by-side comparison
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { Badge } from '~/components/ui/badge';
import { Separator } from '~/components/ui/separator';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '~/lib/utils';
import {
  formatEnrichedValue,
  getConfidenceColor,
  getConfidenceLabel,
  type EnrichmentData,
} from '~/hooks/useLeadEnrichment';

interface EnrichmentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrichmentData: EnrichmentData | null;
  currentLeadData?: Record<string, any>;
  onApply: (selectedFields: string[]) => void;
  isApplying?: boolean;
}

export function EnrichmentPreviewModal({
  open,
  onOpenChange,
  enrichmentData,
  currentLeadData = {},
  onApply,
  isApplying = false,
}: EnrichmentPreviewModalProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  if (!enrichmentData || !enrichmentData.enriched_fields) {
    return null;
  }

  const enrichedFields = enrichmentData.enriched_fields;
  const confidenceScores = enrichmentData.confidence_scores || {};

  // Initialize all high-confidence fields as selected
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      const highConfidenceFields = Object.entries(confidenceScores)
        .filter(([_, score]) => score >= 0.7)
        .map(([field]) => field);
      setSelectedFields(new Set(highConfidenceFields));
    }
    onOpenChange(newOpen);
  };

  const toggleField = (field: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(field)) {
      newSelected.delete(field);
    } else {
      newSelected.add(field);
    }
    setSelectedFields(newSelected);
  };

  const handleApply = () => {
    onApply(Array.from(selectedFields));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Enrichment Data</DialogTitle>
          <DialogDescription>
            Review the enriched data and select which fields to apply to the lead.
            High-confidence fields are selected by default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {Object.entries(enrichedFields).map(([field, data]) => {
            const confidence = confidenceScores[field] || 0;
            const currentValue = currentLeadData[field];
            const newValue = data.value;
            const isSelected = selectedFields.has(field);
            const hasChanged = currentValue !== newValue;

            return (
              <div
                key={field}
                className={cn(
                  'border rounded-lg p-4 space-y-3',
                  isSelected && 'border-primary bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Checkbox
                      id={`field-${field}`}
                      checked={isSelected}
                      onCheckedChange={() => toggleField(field)}
                    />
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={`field-${field}`}
                        className="text-sm font-semibold capitalize cursor-pointer"
                      >
                        {field.replace(/_/g, ' ')}
                      </label>
                    </div>
                  </div>

                  <Badge
                    className={cn(
                      'whitespace-nowrap',
                      confidence >= 0.8
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : confidence >= 0.6
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                    )}
                  >
                    {getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
                  </Badge>
                </div>

                <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center ml-8">
                  {/* Current Value */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Current</p>
                    <p className="text-sm">
                      {currentValue ? formatEnrichedValue(currentValue) : (
                        <span className="text-muted-foreground italic">No value</span>
                      )}
                    </p>
                  </div>

                  {/* Arrow */}
                  <ArrowRight
                    className={cn(
                      'h-4 w-4',
                      hasChanged
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    )}
                  />

                  {/* New Value */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Enriched</p>
                    <p className={cn(
                      'text-sm font-medium',
                      hasChanged && 'text-primary'
                    )}>
                      {formatEnrichedValue(newValue)}
                    </p>
                  </div>
                </div>

                {/* Source */}
                <div className="ml-8">
                  <p className="text-xs text-muted-foreground">
                    Source: {data.source}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {selectedFields.size} of {Object.keys(enrichedFields).length} fields
            selected
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={selectedFields.size === 0 || isApplying}
          >
            {isApplying ? 'Applying...' : `Apply ${selectedFields.size} Field${selectedFields.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
