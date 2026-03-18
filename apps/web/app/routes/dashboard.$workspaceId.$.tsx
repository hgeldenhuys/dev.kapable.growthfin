/**
 * Catch-all route for unmatched paths under /dashboard/:workspaceId/*
 * Renders a 404 page within the app shell (sidebar + header)
 */

import { AlertCircle, ArrowLeft, Home } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Button } from '~/components/ui/button';

export default function CatchAllPage() {
  const { workspaceId } = useParams();

  return (
    <div className="flex flex-col items-center justify-center p-12 gap-4 min-h-[60vh]">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <span className="text-sm font-mono text-muted-foreground">404</span>
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-muted-foreground text-sm text-center max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Go Back
        </Button>
        <Button size="sm" asChild>
          <Link to={`/dashboard/${workspaceId}/crm`}>
            <Home className="h-4 w-4 mr-1" />
            CRM Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
