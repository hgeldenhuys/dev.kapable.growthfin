/**
 * Route: A/B Test Results
 * View and analyze A/B test performance
 */

import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { ABTestResults } from '~/components/crm/campaigns/ABTestResults';
import {
  useABTestResults,
  useEvaluateABTest,
  useAutoDeclareWinner,
  useDeclareWinner,
} from '~/hooks/useCampaignABTesting';
import { Skeleton } from '~/components/ui/skeleton';
import { Card, CardContent } from '~/components/ui/card';

export default function ABTestResultsPage() {
  const { workspaceId, testId } = useParams();
  const navigate = useNavigate();

  if (!workspaceId || !testId) {
    throw new Error('Workspace ID and Test ID are required');
  }

  // testId here acts as campaignId — backend A/B tests are campaign-centric
  const { data: resultsData, isLoading, error } = useABTestResults(workspaceId, testId);
  const evaluateWinner = useEvaluateABTest(workspaceId, testId);
  const promoteWinner = useAutoDeclareWinner(workspaceId, testId);
  const manualOverride = useDeclareWinner(workspaceId, testId);

  const handleEvaluateWinner = async () => {
    try {
      await evaluateWinner.mutateAsync({ workspaceId });
    } catch (error) {
      console.error('Failed to evaluate winner:', error);
    }
  };

  const handlePromoteWinner = async () => {
    try {
      await promoteWinner.mutateAsync({ workspaceId });
    } catch (error) {
      console.error('Failed to promote winner:', error);
    }
  };

  const handleManualOverride = async (messageId: string) => {
    try {
      await manualOverride.mutateAsync({
        workspaceId,
        userId: '', // TODO: pass actual userId from context
        messageId,
      });
    } catch (error) {
      console.error('Failed to declare winner:', error);
    }
  };

  const handleExportCSV = () => {
    if (!resultsData) return;

    // Prepare CSV data
    const headers = [
      'Variant',
      'Recipients',
      'Delivered',
      'Opened',
      'Clicked',
      'Converted',
      'Open Rate',
      'Click Rate',
      'Conversion Rate',
    ];

    const rows = resultsData.variants.map((variant) => [
      variant.variantName,
      variant.recipientsCount.toString(),
      variant.deliveredCount.toString(),
      variant.openedCount.toString(),
      variant.clickedCount.toString(),
      variant.convertedCount.toString(),
      (variant.openRate * 100).toFixed(2) + '%',
      (variant.clickRate * 100).toFixed(2) + '%',
      (variant.conversionRate * 100).toFixed(2) + '%',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ab-test-${resultsData.testName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBack = () => {
    navigate(`/dashboard/${workspaceId}/campaigns/ab-tests`);
  };

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-lg font-semibold text-destructive">
                Failed to load A/B test results
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
              <Button className="mt-4" onClick={handleBack}>
                Back to A/B Tests
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to A/B Tests
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      )}

      {/* Results */}
      {resultsData && (
        <ABTestResults
          data={resultsData}
          onEvaluateWinner={handleEvaluateWinner}
          onPromoteWinner={handlePromoteWinner}
          onExportCSV={handleExportCSV}
          onManualOverride={handleManualOverride}
          isEvaluating={evaluateWinner.isPending}
          isPromoting={promoteWinner.isPending}
        />
      )}
    </div>
  );
}
