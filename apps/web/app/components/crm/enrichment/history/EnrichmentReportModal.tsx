/**
 * EnrichmentReportModal Component
 * Modal/Dialog showing full markdown enrichment report
 */

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Skeleton } from '~/components/ui/skeleton';
import { useEnrichmentHistoryEntry } from '~/hooks/useEnrichmentHistory';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '~/components/ui/alert';

interface EnrichmentReportModalProps {
  entryId: string | null;
  open: boolean;
  onClose: () => void;
}

export function EnrichmentReportModal({
  entryId,
  open,
  onClose,
}: EnrichmentReportModalProps) {
  const { data, isLoading, error } = useEnrichmentHistoryEntry(entryId);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enrichment Report</DialogTitle>
          <DialogDescription>
            {data?.createdAt ? (
              <>Generated on {formatDate(data.createdAt)}</>
            ) : (
              'Loading report details...'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load report: {error.message}
              </AlertDescription>
            </Alert>
          ) : data?.enrichmentReport ? (
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const inline = !match;
                    return !inline ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {data.enrichmentReport}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No enrichment report available for this entry
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
