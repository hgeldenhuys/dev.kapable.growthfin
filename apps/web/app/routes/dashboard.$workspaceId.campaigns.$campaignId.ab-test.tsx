/**
 * Route: A/B Test Configuration
 * Placeholder — AB test creation is not yet implemented in the backend.
 * AB test variants are currently managed through campaign messages.
 */

import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';

export default function CampaignABTestPage() {
  const { workspaceId, campaignId } = useParams();
  const navigate = useNavigate();

  if (!workspaceId || !campaignId) {
    throw new Error('Workspace ID and Campaign ID are required');
  }

  return (
    <div className="container mx-auto max-w-5xl py-8">
      <div className="mb-6 flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Campaign
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">A/B Testing</h1>
        <p className="mt-2 text-muted-foreground">
          Test different variants to optimize campaign performance
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">Coming Soon</h3>
          <p className="mb-6 text-center text-sm text-muted-foreground max-w-md">
            A/B test creation will be available in a future release. Currently, you can create
            multiple message variants for a campaign and view their performance in the campaign
            results page.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate(`/dashboard/${workspaceId}/crm/campaigns/${campaignId}`)}
          >
            Back to Campaign
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
