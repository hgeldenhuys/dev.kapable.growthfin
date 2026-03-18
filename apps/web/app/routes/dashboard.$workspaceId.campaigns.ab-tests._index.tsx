/**
 * Route: A/B Tests List
 * Placeholder — A/B test results are accessed per-campaign via /campaigns/:id/ab-test-results
 * No global listing endpoint exists on the backend.
 */

import { useNavigate, useParams } from 'react-router';
import { TrendingUp, ArrowLeft } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';

export default function ABTestsListPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="mb-6 flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Campaigns
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">A/B Tests</h1>
        <p className="mt-2 text-muted-foreground">
          View and manage campaign A/B tests
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">A/B tests are per-campaign</h3>
          <p className="mb-6 text-center text-sm text-muted-foreground max-w-md">
            A/B test results are available on individual campaign pages. Navigate to a campaign and
            view its A/B test variants and performance metrics.
          </p>
          <Button onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns`)}>
            View Campaigns
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
