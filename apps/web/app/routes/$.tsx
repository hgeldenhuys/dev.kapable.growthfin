/**
 * Root catch-all route for unmatched paths
 * Renders a standalone 404 page
 */

import { AlertCircle, ArrowLeft, Home } from 'lucide-react';
import { Link } from 'react-router';

export default function RootCatchAllPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background text-foreground">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
      </div>
      <span className="text-sm font-mono text-muted-foreground">404</span>
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-muted-foreground text-sm text-center max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="flex gap-2 mt-4">
        <button
          className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Go Back
        </button>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3"
        >
          <Home className="h-4 w-4 mr-1" />
          Home
        </Link>
      </div>
    </div>
  );
}
