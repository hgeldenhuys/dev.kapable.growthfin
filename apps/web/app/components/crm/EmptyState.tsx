/**
 * EmptyState Component
 * Reusable empty state for CRM pages with no data.
 * Shows icon, title, description, optional CTA, and optional guide link.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useRevalidator } from 'react-router';
import { Card, CardContent } from '~/components/ui/card';
import { BookOpen, Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  guideStep?: number;
  guideLabel?: string;
  action?: ReactNode;
  workspaceId: string;
  showSampleData?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  guideStep,
  guideLabel = 'Learn how',
  action,
  workspaceId,
  showSampleData,
}: EmptyStateProps) {
  const [seeding, setSeeding] = useState(false);
  const revalidator = useRevalidator();

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const res = await fetch(
        `/api/v1/crm/onboarding/seed-sample-data?workspaceId=${workspaceId}`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load sample data');
      }
      toast.success('Sample data loaded! Refreshing...');
      revalidator.revalidate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sample data');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center text-center py-12">
        <div className="text-muted-foreground mb-4 [&>svg]:h-12 [&>svg]:w-12">
          {icon}
        </div>

        <h3 className="text-lg font-semibold mb-2">{title}</h3>

        <p className="text-sm text-muted-foreground max-w-md mb-6">
          {description}
        </p>

        {action && <div className="mb-4">{action}</div>}

        {guideStep != null && (
          <Link
            to={`/dashboard/${workspaceId}/docs/getting-started#step-${guideStep}`}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {guideLabel}
          </Link>
        )}

        {showSampleData && (
          <p className="mt-3 text-xs text-muted-foreground">
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedData}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors underline underline-offset-2 disabled:opacity-50"
            >
              {seeding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Database className="h-3 w-3" />
              )}
              {seeding ? 'Loading sample data...' : 'Or load sample data to explore'}
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
