/**
 * Enrichment Preview Dialog
 * Shows preview of what will be applied before user confirms
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useEnrichmentPreview, useApplyEnrichments } from '~/hooks/useResearch';
import { toast } from 'sonner';

interface EnrichmentPreviewDialogProps {
  sessionId: string;
  workspaceId: string;
  userId: string;
  open: boolean;
  onClose: () => void;
}

export function EnrichmentPreviewDialog({
  sessionId,
  workspaceId,
  userId,
  open,
  onClose,
}: EnrichmentPreviewDialogProps) {
  const { data: preview, isLoading } = useEnrichmentPreview(sessionId, workspaceId);
  const applyMutation = useApplyEnrichments();

  const handleApply = () => {
    applyMutation.mutate(
      { sessionId, workspaceId, userId },
      {
        onSuccess: () => {
          toast.success('Enrichments applied', { description: 'Contact record has been updated successfully.' });
          onClose();
        },
        onError: (error) => {
          toast.error('Failed to apply enrichments', { description: String(error) });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Enrichments</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {preview && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-medium text-blue-900 dark:text-blue-100">
                  {preview.findingsCount} findings ready to apply
                </h3>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                The following fields will be updated on the contact record:
              </p>
            </div>

            {/* Direct Fields */}
            {Object.keys(preview.updates.direct).length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Contact Fields</h4>
                <div className="space-y-2">
                  {Object.entries(preview.updates.direct).map(([field, value]) => (
                    <div
                      key={field}
                      className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm capitalize">
                          {field.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {String(value)}
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Fields */}
            {Object.keys(preview.updates.metadata).length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Additional Details</h4>
                <div className="space-y-2">
                  {Object.entries(preview.updates.metadata).map(([field, value]) => (
                    <div
                      key={field}
                      className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm capitalize">
                          {field.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Findings Details */}
            <div>
              <h4 className="font-medium mb-3">Findings Breakdown</h4>
              <div className="space-y-2">
                {preview.findings.map((finding) => (
                  <div
                    key={finding.id}
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      finding.willApply
                        ? 'bg-green-50 dark:bg-green-950'
                        : 'bg-gray-50 dark:bg-gray-900'
                    }`}
                  >
                    {finding.willApply ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {finding.category.replace(/_/g, ' ')}
                        </Badge>
                        <Badge
                          variant={
                            finding.confidence === 'high'
                              ? 'default'
                              : finding.confidence === 'medium'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-xs"
                        >
                          {finding.confidence}
                        </Badge>
                        {finding.targetField && (
                          <span className="text-xs text-gray-500">
                            → {finding.targetField}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {finding.finding}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose} disabled={applyMutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={applyMutation.isPending || preview.findingsCount === 0}
              >
                {applyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  `Apply ${preview.findingsCount} Findings`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
