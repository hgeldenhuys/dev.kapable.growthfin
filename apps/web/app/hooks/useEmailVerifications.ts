/**
 * useEmailVerifications Hook
 * React Query hooks for email verification attempts audit trail
 *
 * Story: CRM-005 - Email Verification Audit Trail
 * Task: T-004
 */

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from './useWorkspace';

/**
 * Parsed email verification attempt
 */
export interface EmailVerificationAttempt {
  id: string;
  email: string;
  status: string;
  statusLabel: string;
  statusVariant: 'default' | 'destructive' | 'secondary' | 'outline';
  subStatus: string;
  subStatusLabel: string;
  subStatusSeverity: 'info' | 'warning' | 'error';
  mxFound: boolean;
  mxRecord: string;
  smtpProvider: string;
  mxInfo: string;
  domain: string;
  isValid: boolean;
  processedAt: string;
  suggestion: string | null;
}

/**
 * Summary statistics for email verifications
 */
export interface EmailVerificationSummary {
  total: number;
  valid: number;
  invalid: number;
  other: number;
}

/**
 * API response for email verifications list
 */
export interface EmailVerificationsResponse {
  attempts: EmailVerificationAttempt[];
  summary: EmailVerificationSummary;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
  };
}

/**
 * Get email verification attempts for a lead or contact
 */
export function useEmailVerifications(
  entityId: string,
  entityType: 'contact' | 'lead',
  options?: {
    page?: number;
    limit?: number;
    enabled?: boolean;
  }
) {
  const workspaceId = useWorkspaceId();
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 50;
  const enabled = options?.enabled ?? true;

  return useQuery<EmailVerificationsResponse>({
    queryKey: ['email-verifications', entityId, entityType, workspaceId, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        entityId,
        entityType,
        page: String(page),
        limit: String(limit),
      });

      const res = await fetch(`/api/v1/crm/email-verifications?${params}`);

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch email verifications');
      }

      const data = await res.json();
      return data as EmailVerificationsResponse;
    },
    enabled: !!workspaceId && !!entityId && enabled,
  });
}

/**
 * Get only failed/invalid email verification attempts
 */
export function useFailedEmailVerifications(
  entityId: string,
  entityType: 'contact' | 'lead',
  options?: {
    enabled?: boolean;
  }
) {
  const workspaceId = useWorkspaceId();
  const enabled = options?.enabled ?? true;

  return useQuery<{ attempts: EmailVerificationAttempt[]; totalCount: number }>({
    queryKey: ['email-verifications-failed', entityId, entityType, workspaceId],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        entityId,
        entityType,
      });

      const res = await fetch(`/api/v1/crm/email-verifications/failed?${params}`);

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch failed email verifications');
      }

      const data = await res.json();
      return data;
    },
    enabled: !!workspaceId && !!entityId && enabled,
  });
}

/**
 * Get summary only (lightweight - no attempt details)
 */
export function useEmailVerificationSummary(
  entityId: string,
  entityType: 'contact' | 'lead',
  options?: {
    enabled?: boolean;
  }
) {
  const workspaceId = useWorkspaceId();
  const enabled = options?.enabled ?? true;

  return useQuery<{
    entityId: string;
    entityType: 'contact' | 'lead';
    summary: EmailVerificationSummary;
  }>({
    queryKey: ['email-verifications-summary', entityId, entityType, workspaceId],
    queryFn: async () => {
      const params = new URLSearchParams({
        workspaceId,
        entityType,
      });

      const res = await fetch(
        `/api/v1/crm/email-verifications/summary/${entityId}?${params}`
      );

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch email verification summary');
      }

      const data = await res.json();
      return data;
    },
    enabled: !!workspaceId && !!entityId && enabled,
  });
}

/**
 * Get email verification attempts for a specific enrichment job
 */
export function useEmailVerificationsByJob(
  jobId: string,
  options?: {
    enabled?: boolean;
  }
) {
  const workspaceId = useWorkspaceId();
  const enabled = options?.enabled ?? true;

  return useQuery<{
    attempts: EmailVerificationAttempt[];
    totalCount: number;
    summary: {
      total: number;
      valid: number;
      invalid: number;
    };
  }>({
    queryKey: ['email-verifications-by-job', jobId, workspaceId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/crm/email-verifications/by-job/${jobId}?workspaceId=${workspaceId}`
      );

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to fetch email verifications by job');
      }

      const data = await res.json();
      return data;
    },
    enabled: !!workspaceId && !!jobId && enabled,
  });
}
