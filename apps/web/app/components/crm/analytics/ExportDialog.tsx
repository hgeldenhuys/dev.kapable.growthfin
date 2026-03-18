/**
 * ExportDialog Component
 * Dialog for exporting analytics data to CSV
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import {
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '~/lib/utils';

export type ExportType =
  | 'campaign_metrics'
  | 'funnel_data'
  | 'channel_performance'
  | 'recipient_details';

export interface ExportOption {
  id: ExportType;
  label: string;
  description: string;
  icon: typeof FileSpreadsheet;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'campaign_metrics',
    label: 'Campaign Summary',
    description: 'Overall metrics, objectives, and performance',
    icon: FileSpreadsheet,
  },
  {
    id: 'funnel_data',
    label: 'Funnel Data',
    description: 'Conversion rates at each stage (requires campaign selection)',
    icon: FileSpreadsheet,
  },
  {
    id: 'channel_performance',
    label: 'Channel Performance',
    description: 'Breakdown by communication channel',
    icon: FileSpreadsheet,
  },
  {
    id: 'recipient_details',
    label: 'Recipient Details',
    description: 'Individual recipient engagement data',
    icon: FileSpreadsheet,
  },
];

interface ExportDialogProps {
  workspaceId: string;
  campaignId?: string;
  onExport: (exportType: ExportType) => Promise<{ jobId: string }>;
  onPollStatus: (jobId: string) => Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    downloadUrl?: string;
    error?: string;
  }>;
  children?: React.ReactNode;
}

export function ExportDialog({
  workspaceId,
  campaignId,
  onExport,
  onPollStatus,
  children,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ExportType>('campaign_metrics');
  const [exportState, setExportState] = useState<
    'idle' | 'exporting' | 'completed' | 'error'
  >('idle');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setExportState('exporting');
    setError(null);
    setProgress(0);

    try {
      // Start export job
      const { jobId } = await onExport(selectedType);
      setProgress(25);

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      const pollInterval = 1000; // Check every second

      const poll = async () => {
        attempts++;
        const status = await onPollStatus(jobId);

        if (status.status === 'completed' && status.downloadUrl) {
          setDownloadUrl(status.downloadUrl);
          setProgress(100);
          setExportState('completed');
        } else if (status.status === 'failed') {
          setError(status.error || 'Export failed');
          setExportState('error');
        } else if (attempts >= maxAttempts) {
          setError('Export timed out. Please try again.');
          setExportState('error');
        } else {
          // Update progress based on status
          if (status.status === 'processing') {
            setProgress(50);
          }
          setTimeout(poll, pollInterval);
        }
      };

      setTimeout(poll, pollInterval);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setExportState('error');
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setExportState('idle');
      setDownloadUrl(null);
      setError(null);
      setProgress(0);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Export Analytics Data</DialogTitle>
          <DialogDescription>
            Choose an export format and download your campaign data as CSV
          </DialogDescription>
        </DialogHeader>

        {exportState === 'idle' && (
          <>
            <div className="space-y-3 py-4">
              {EXPORT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedType === option.id;

                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedType(option.id)}
                    className={cn(
                      'w-full flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'font-medium mb-1',
                          isSelected && 'text-primary'
                        )}
                      >
                        {option.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </Button>
            </DialogFooter>
          </>
        )}

        {exportState === 'exporting' && (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium mb-2">Generating export...</p>
                <p className="text-sm text-muted-foreground">
                  This may take a few moments
                </p>
              </div>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {exportState === 'completed' && (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <div className="text-center">
                <p className="font-medium mb-2">Export ready!</p>
                <p className="text-sm text-muted-foreground">
                  Your CSV file is ready to download
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </DialogFooter>
          </div>
        )}

        {exportState === 'error' && (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-red-100 rounded-full">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </div>
              <div className="text-center">
                <p className="font-medium mb-2">Export failed</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleExport}>Try Again</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
