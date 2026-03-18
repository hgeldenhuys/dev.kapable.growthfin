/**
 * React Query hooks for Campaign A/B Testing
 *
 * Backend routes (all under /campaigns prefix):
 *   GET  /campaigns/:id/ab-test-results     → Get variant performance metrics
 *   POST /campaigns/:id/declare-winner       → Manual winner declaration
 *   POST /campaigns/:id/auto-declare-winner  → Auto-declare by metrics
 *   POST /campaigns/:id/evaluate             → Statistical analysis (chi-square, CI)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TYPES — aligned with backend response shapes
// ============================================================================

interface VariantMetrics {
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  openRate: number | null;
  clickRate: number | null;
  bounceRate: number | null;
}

interface ABTestVariant {
  id: string;
  messageId: string;
  variantName: string;
  isWinner: boolean;
  metrics: VariantMetrics;
  winnerDeclaredAt: string | null;
  winningCriteria: string | null;
  message: any;
}

interface ABTestResultsResponse {
  campaignId: string;
  campaignName: string;
  variants: ABTestVariant[];
  totalVariants: number;
  hasWinner: boolean;
}

interface DeclareWinnerRequest {
  workspaceId: string;
  userId: string;
  messageId: string;
  criteria?: 'open_rate' | 'click_rate' | 'manual' | 'engagement';
}

interface DeclareWinnerResponse {
  success: boolean;
  messageId: string;
  variantName: string;
  criteria: string;
}

interface AutoDeclareWinnerRequest {
  workspaceId: string;
  criteria?: 'open_rate' | 'click_rate' | 'engagement';
  minSampleSize?: number;
}

interface EvaluateRequest {
  workspaceId: string;
  criteria?: 'open_rate' | 'click_rate' | 'engagement';
  minSampleSize?: number;
}

interface ConfidenceInterval {
  lower: string;
  upper: string;
  margin: string;
}

interface EvaluationVariant {
  variantName: string;
  messageId: string;
  performance: {
    rate: number;
    ratePercentage: string;
    count: number;
    total: number;
  };
  confidenceInterval: ConfidenceInterval;
}

interface StatisticalTest {
  chiSquare: string;
  pValue: string;
  degreesOfFreedom: number;
  isSignificant: boolean;
  interpretation: string;
}

interface RecommendedWinner {
  variantName: string;
  messageId: string;
  lift: string;
  liftPercentage: string;
}

interface EvaluationResponse {
  success: boolean;
  campaignId: string;
  campaignName: string;
  criteria: string;
  evaluation: {
    hasMinimumSample: boolean;
    sampleValidation: any;
    variants: EvaluationVariant[];
    statisticalTest: StatisticalTest | null;
    recommendedWinner: RecommendedWinner | null;
  };
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch A/B test results for a campaign
 * GET /campaigns/:id/ab-test-results?workspaceId=...
 */
export function useABTestResults(workspaceId: string, campaignId: string) {
  return useQuery({
    queryKey: ['ab-test-results', workspaceId, campaignId],
    queryFn: async (): Promise<ABTestResultsResponse> => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}/ab-test-results?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to fetch A/B test results');
      }

      return response.json();
    },
    enabled: !!campaignId && !!workspaceId,
    refetchInterval: (query) => {
      // Auto-refresh every 30s if test has no winner yet
      const data = query.state.data;
      return data && !data.hasWinner ? 30000 : false;
    },
  });
}

/**
 * Manually declare an A/B test winner
 * POST /campaigns/:id/declare-winner
 */
export function useDeclareWinner(workspaceId: string, campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DeclareWinnerRequest): Promise<DeclareWinnerResponse> => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}/declare-winner?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to declare winner');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['ab-test-results', workspaceId, campaignId],
      });
    },
  });
}

/**
 * Auto-declare A/B test winner based on metrics
 * POST /campaigns/:id/auto-declare-winner
 */
export function useAutoDeclareWinner(workspaceId: string, campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AutoDeclareWinnerRequest): Promise<DeclareWinnerResponse> => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}/auto-declare-winner?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to auto-declare winner');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['ab-test-results', workspaceId, campaignId],
      });
    },
  });
}

/**
 * Evaluate A/B test with statistical analysis (does not declare winner)
 * POST /campaigns/:id/evaluate
 */
export function useEvaluateABTest(workspaceId: string, campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EvaluateRequest): Promise<EvaluationResponse> => {
      const response = await fetch(
        `/api/v1/crm/campaigns/${campaignId}/evaluate?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to evaluate A/B test');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['ab-test-results', workspaceId, campaignId],
      });
    },
  });
}

// ============================================================================
// LEGACY EXPORTS — map old names to new hooks for backward compatibility
// ============================================================================

/** @deprecated Use useDeclareWinner instead */
export const useManualOverrideWinner = useDeclareWinner;

/** @deprecated Use useEvaluateABTest instead */
export const useEvaluateWinner = useEvaluateABTest;

/** @deprecated Use useAutoDeclareWinner instead */
export const usePromoteWinner = useAutoDeclareWinner;
