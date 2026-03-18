/**
 * ImportProgressStep Component
 * Step 4: Show real-time import progress with SSE
 */

import { useEffect, useState } from 'react';
import { CheckCircle, Download, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { useImportStatus } from '~/hooks/useLeadImport';

interface ImportProgressStepProps {
  importId: string;
  workspaceId: string;
  onComplete: (importId: string, listId?: string) => void;
}

interface ImportStatus {
  status: 'validating' | 'importing' | 'completed' | 'failed';
  total_rows: number;
  processed_rows: number;
  imported_rows: number;
  error_rows: number;
  error_file_url?: string;
  list_id?: string;
  error_details?: Array<{
    line: number;
    field: string;
    message: string;
  }>;
}

export function ImportProgressStep({
  importId,
  workspaceId,
  onComplete,
}: ImportProgressStepProps) {
  const { data: status, isLoading } = useImportStatus(importId, workspaceId);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (status?.status === 'completed') {
      setIsComplete(true);
    }
  }, [status]);

  if (isLoading || !status) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const percentage = status.total_rows > 0 && status.processed_rows !== undefined
    ? Math.round((status.processed_rows / status.total_rows) * 100)
    : status.status === 'completed' ? 100 : 0;

  const getStatusMessage = () => {
    switch (status.status) {
      case 'validating':
        return 'Validating data...';
      case 'importing':
        return 'Importing leads...';
      case 'completed':
        return 'Import completed successfully!';
      case 'failed':
        return 'Import failed';
      default:
        return 'Processing...';
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="text-center space-y-2">
        {status.status === 'completed' ? (
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>
        ) : status.status === 'failed' ? (
          <div className="flex justify-center">
            <div className="rounded-full bg-red-100 p-4">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="rounded-full bg-blue-100 p-4">
              <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            </div>
          </div>
        )}
        <h3 className="text-xl font-semibold">{getStatusMessage()}</h3>
        <p className="text-sm text-muted-foreground">
          {status.processed_rows} of {status.total_rows} rows processed
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{percentage}%</span>
        </div>
        <Progress value={percentage} className="h-3" />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{status.imported_rows}</div>
          <div className="text-sm text-muted-foreground">Imported</div>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{status.error_rows}</div>
          <div className="text-sm text-muted-foreground">Failed</div>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{status.processed_rows}</div>
          <div className="text-sm text-muted-foreground">Total Processed</div>
        </div>
      </div>

      {/* Error Report with Details */}
      {isComplete && status.error_rows > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900">
                {status.error_rows} rows failed to import
              </p>

              {/* Show error details if available */}
              {status.error_details && status.error_details.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-red-800">Error Details:</p>
                  <div className="max-h-60 overflow-y-auto bg-white rounded-md border border-red-200 p-3">
                    <ul className="space-y-2 text-sm">
                      {status.error_details.slice(0, 20).map((error, index) => (
                        <li key={index} className="text-red-700">
                          <span className="font-medium">Row {error.line}:</span>{' '}
                          <span className="text-red-600">
                            {error.field === 'database' ? (
                              error.message
                            ) : (
                              `${error.field} - ${error.message}`
                            )}
                          </span>
                        </li>
                      ))}
                      {status.error_details.length > 20 && (
                        <li className="text-red-600 font-medium">
                          ... and {status.error_details.length - 20} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Download button if error file is available */}
              {status.error_file_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    window.open(status.error_file_url, '_blank');
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Full Error Report
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {isComplete && status.error_rows === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">
                All {status.imported_rows} leads imported successfully!
              </p>
              <p className="text-sm text-green-700 mt-1">
                Your leads have been added to the system and are ready to use.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {isComplete && (
        <div className="flex justify-center">
          <Button onClick={() => onComplete(importId, status.list_id)}>
            {status.list_id ? 'View Imported List' : 'View Imported Leads'}
          </Button>
        </div>
      )}
    </div>
  );
}
