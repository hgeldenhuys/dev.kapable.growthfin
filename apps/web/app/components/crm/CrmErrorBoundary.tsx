import { useRouteError, isRouteErrorResponse, Link } from 'react-router';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '~/components/ui/button';

export function CrmErrorBoundary() {
  const error = useRouteError();
  const isRouteError = isRouteErrorResponse(error);

  let title = 'Something went wrong';
  let message = 'An unexpected error occurred. Please try again.';
  let status: number | undefined;

  if (isRouteError) {
    status = error.status;
    if (error.status === 404) {
      title = 'Page not found';
      message = 'The page you are looking for does not exist or has been moved.';
    } else if (error.status === 401 || error.status === 403) {
      title = 'Access denied';
      message = 'You do not have permission to view this page.';
    } else if (error.status >= 500) {
      title = 'Server error';
      message = 'The server encountered an error. Please try again later.';
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 gap-4 min-h-[400px]">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      {status && (
        <span className="text-sm font-mono text-muted-foreground">{status}</span>
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground text-sm text-center max-w-md">{message}</p>
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Go Back
        </Button>
        <Button size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
