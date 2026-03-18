/**
 * Reusable Error State Component
 * Used across all SDLC Dashboard tabs for error handling
 */

import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = "Error Loading Data",
  message,
  onRetry,
  retryLabel = "Retry"
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" className="my-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="mb-3">{message}</div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {retryLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
