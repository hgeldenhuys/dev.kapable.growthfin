/**
 * useLeadPrediction Hook
 * React hooks for AI-powered predictive conversion scoring
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '~/lib/api';
import { toast } from 'sonner';


export interface PredictionFactor {
  factor: string;
  contribution: number;
  description: string;
}

export interface PredictionResult {
  lead_id: string;
  prediction_score: number;
  confidence_interval: number;
  prediction_category: 'high_probability' | 'medium_probability' | 'low_probability';
  top_factors: PredictionFactor[];
  model_accuracy: number;
  predicted_at: string;
}

export interface PredictionModel {
  id: string;
  workspace_id: string;
  model_type: 'conversion' | 'churn' | 'lifetime_value';
  model_version: string;
  algorithm: string;
  training_samples: number;
  training_started_at: string;
  training_completed_at?: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  feature_importance?: Record<string, number>;
  is_active: boolean;
  created_at: string;
}

export interface TrainModelRequest {
  workspaceId: string;
  modelType?: 'conversion' | 'churn' | 'lifetime_value';
  minSamples?: number;
}

/**
 * Get prediction for a specific lead
 */
export function usePredictLead(leadId: string, workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'prediction', leadId, workspaceId],
    queryFn: async () => {
      // Backend route is POST /api/v1/crm/predictions/leads/:leadId
      const response = await fetch(
        `/api/v1/crm/predictions/leads/${leadId}?workspaceId=${workspaceId}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch prediction: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if response contains an error (API returns 200 with error object)
      if (data.error) {
        throw new Error(data.message || data.error);
      }

      return data as PredictionResult;
    },
    enabled: !!leadId && !!workspaceId,
    retry: 1, // Limit retries to prevent excessive 404 spam
  });
}

/**
 * Get available prediction models for workspace
 */
export function usePredictionModels(workspaceId: string) {
  return useQuery({
    queryKey: ['crm', 'predictions', 'models', workspaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/crm/predictions/models?workspaceId=${workspaceId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models as PredictionModel[];
    },
    enabled: !!workspaceId,
  });
}

/**
 * Train a new prediction model
 */
export function useTrainModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: TrainModelRequest) => {
      const response = await fetch(
        `/api/v1/crm/predictions/train`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to start model training');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      toast.success('Model Training Started', { description: 'The prediction model is being trained. This may take several minutes.' });

      // Invalidate models list
      queryClient.invalidateQueries({
        queryKey: ['crm', 'predictions', 'models', variables.workspaceId],
      });
    },
    onError: (error: Error) => {
      toast.error('Training Failed', { description: error.message });
    },
  });
}

/**
 * Get prediction category color for UI
 */
export function getPredictionCategoryColor(
  category: 'high_probability' | 'medium_probability' | 'low_probability'
): string {
  switch (category) {
    case 'high_probability':
      return 'text-green-600 dark:text-green-400';
    case 'medium_probability':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'low_probability':
      return 'text-red-600 dark:text-red-400';
  }
}

/**
 * Get prediction score color gradient
 */
export function getPredictionScoreColor(score: number): string {
  if (score >= 70) return 'from-green-500 to-green-600';
  if (score >= 40) return 'from-yellow-500 to-yellow-600';
  return 'from-red-500 to-red-600';
}

/**
 * Get prediction score background color
 */
export function getPredictionScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-green-100 dark:bg-green-900';
  if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900';
  return 'bg-red-100 dark:bg-red-900';
}

/**
 * Get prediction score text color
 */
export function getPredictionScoreTextColor(score: number): string {
  if (score >= 70) return 'text-green-800 dark:text-green-200';
  if (score >= 40) return 'text-yellow-800 dark:text-yellow-200';
  return 'text-red-800 dark:text-red-200';
}

/**
 * Format factor name for display
 */
export function formatFactorName(factor: string): string {
  return factor
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Get model accuracy badge color
 */
export function getModelAccuracyColor(accuracy: number): string {
  if (accuracy >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (accuracy >= 0.7) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}
