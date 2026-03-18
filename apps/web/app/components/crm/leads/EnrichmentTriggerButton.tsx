/**
 * EnrichmentTriggerButton Component
 * Button to manually trigger lead enrichment with loading state
 * Opens EnrichmentPreviewModal when enrichment completes
 */

import { useState, useEffect, useRef } from 'react';
import { useRevalidator } from 'react-router';
import { Button } from '~/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { Sparkles, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useEnrichLead, useEnrichmentStatus, useCancelEnrichment, type EnrichmentData } from '~/hooks/useLeadEnrichment';
import { EnrichmentPreviewModal } from './EnrichmentPreviewModal';
import { toast } from 'sonner';

interface EnrichmentTriggerButtonProps {
  leadId: string;
  workspaceId: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showIcon?: boolean;
  showText?: boolean;
  force?: boolean;
  className?: string;
  currentLeadData?: Record<string, any>;
}

export function EnrichmentTriggerButton({
  leadId,
  workspaceId,
  variant = 'outline',
  size = 'default',
  showIcon = true,
  showText = true,
  force = false,
  className,
  currentLeadData,
}: EnrichmentTriggerButtonProps) {
  const revalidator = useRevalidator();
  const { data: enrichmentStatus } = useEnrichmentStatus(leadId, workspaceId);
  const enrichMutation = useEnrichLead();
  const cancelMutation = useCancelEnrichment();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentData | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>(['company', 'contact', 'social']);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [requestedSources, setRequestedSources] = useState<string[]>([]);

  // Track whether we triggered the current enrichment (so we don't open modal for stale completions)
  const triggeredRef = useRef(false);

  const isEnriching =
    enrichmentStatus?.status === 'in_progress' ||
    enrichmentStatus?.status === 'pending' ||
    enrichMutation.isPending;

  const alreadyEnriched = enrichmentStatus?.status === 'completed';

  const ENRICHMENT_SOURCES = [
    { value: 'company', label: 'Company Data' },
    { value: 'contact', label: 'Contact Info' },
    { value: 'social', label: 'Social Profiles' },
  ] as const;

  const toggleSource = (source: string, checked: boolean) => {
    setSelectedSources(prev =>
      checked ? [...prev, source] : prev.filter(s => s !== source)
    );
  };

  const handleEnrich = () => {
    triggeredRef.current = true;
    setRequestedSources([...selectedSources]);
    setPopoverOpen(false);
    enrichMutation.mutate({
      leadId,
      workspaceId,
      sources: selectedSources,
      force,
    });
  };

  // Watch for enrichment completion — open preview modal
  useEffect(() => {
    if (
      enrichmentStatus?.status === 'completed' &&
      triggeredRef.current
    ) {
      triggeredRef.current = false;
      setEnrichmentResult(enrichmentStatus);
      setPreviewOpen(true);
    }
  }, [enrichmentStatus?.status]);

  // Elapsed-time timer while enrichment is active.
  // Uses the server-side created_at timestamp so the timer survives page refresh.
  useEffect(() => {
    if (enrichmentStatus?.status === 'in_progress' || enrichmentStatus?.status === 'pending') {
      const computeElapsed = () => {
        if (enrichmentStatus.created_at) {
          const elapsedMs = Date.now() - new Date(enrichmentStatus.created_at).getTime();
          return Math.max(0, Math.floor(elapsedMs / 1000));
        }
        return 0;
      };
      setElapsedSeconds(computeElapsed());
      const timer = setInterval(() => setElapsedSeconds(computeElapsed()), 1000);
      return () => clearInterval(timer);
    }
    setElapsedSeconds(0);
  }, [enrichmentStatus?.status, enrichmentStatus?.created_at]);

  const handleApplyFields = async (selectedFields: string[]) => {
    if (!enrichmentResult?.enriched_fields) return;

    const updates: Record<string, any> = {};
    for (const field of selectedFields) {
      const enrichedField = enrichmentResult.enriched_fields[field];
      if (enrichedField) {
        updates[field] = enrichedField.value;
      }
    }

    setIsApplying(true);
    try {
      const response = await fetch(
        `/api/v1/crm/leads/${leadId}?workspaceId=${workspaceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customFields: updates }),
        }
      );
      if (!response.ok) throw new Error('Failed to apply enrichment fields');

      revalidator.revalidate();

      toast.success('Enrichment Applied', { description: `${selectedFields.length} field(s) updated successfully.` });
    } catch (error) {
      toast.error('Apply Failed', { description: String(error) });
    } finally {
      setIsApplying(false);
    }
  };

  const buttonText = isEnriching
    ? 'Enriching...'
    : alreadyEnriched && !force
      ? 'Re-enrich'
      : 'Enrich Lead';

  const ButtonIcon = isEnriching ? Loader2 : alreadyEnriched && !force ? RefreshCw : Sparkles;

  const isOvertime = elapsedSeconds > 60;

  const handleCancel = () => {
    cancelMutation.mutate({ leadId, workspaceId });
  };

  // Skip popover when force is true or enrichment is in progress
  if (force || isEnriching) {
    return (
      <div>
        <Button
          variant={variant}
          size={size}
          onClick={handleEnrich}
          disabled={isEnriching}
          className={className}
        >
          {showIcon && (
            <ButtonIcon
              className={`h-4 w-4 ${showText ? 'mr-2' : ''} ${isEnriching ? 'animate-spin' : ''}`}
            />
          )}
          {showText && buttonText}
        </Button>
        {isOvertime && (
          <div className="mt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
            </Button>
          </div>
        )}
        <EnrichmentPreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          enrichmentData={enrichmentResult}
          currentLeadData={currentLeadData}
          onApply={handleApplyFields}
          isApplying={isApplying}
        />
      </div>
    );
  }

  return (
    <div>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={isEnriching}
            className={className}
          >
            {showIcon && (
              <ButtonIcon
                className={`h-4 w-4 ${showText ? 'mr-2' : ''}`}
              />
            )}
            {showText && buttonText}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Enrichment Sources</h4>
            <div className="space-y-3">
              {ENRICHMENT_SOURCES.map(source => (
                <div key={source.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`source-${source.value}`}
                    checked={selectedSources.includes(source.value)}
                    onCheckedChange={(checked) => toggleSource(source.value, !!checked)}
                  />
                  <Label htmlFor={`source-${source.value}`} className="text-sm cursor-pointer">
                    {source.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated cost: ~$0.02 per lead
            </p>
            <Button
              size="sm"
              className="w-full"
              onClick={handleEnrich}
              disabled={selectedSources.length === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Start Enrichment
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <EnrichmentPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        enrichmentData={enrichmentResult}
        currentLeadData={currentLeadData}
        onApply={handleApplyFields}
        isApplying={isApplying}
      />
    </div>
  );
}
