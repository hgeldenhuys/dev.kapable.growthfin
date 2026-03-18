/// <reference lib="dom" />

/**
 * useCampaigns Hook Tests
 *
 * Tests campaign CRUD operations, message management,
 * audience calculation, and error handling.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper, mockFetch, mockFetchWithCapture } from './test-utils';
import {
  useCampaigns,
  useCampaign,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useActivateCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
} from '../useCampaigns';

const WORKSPACE_ID = 'ws-test-123';
const CAMPAIGN_ID = 'camp-test-456';

const sampleCampaign = {
  id: CAMPAIGN_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Test Campaign',
  type: 'one_time',
  channel: 'email',
  status: 'draft',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('useCampaigns', () => {
  let restoreFetch: () => void;

  afterEach(() => {
    if (restoreFetch) restoreFetch();
  });

  describe('useCampaigns (list)', () => {
    test('fetches campaigns for workspace', async () => {
      restoreFetch = mockFetch({
        [`/api/v1/crm/campaigns?workspaceId=${WORKSPACE_ID}`]: {
          body: [sampleCampaign],
        },
      });

      const { result } = renderHook(
        () => useCampaigns({ workspaceId: WORKSPACE_ID }),
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].name).toBe('Test Campaign');
    });

    test('returns empty array when API returns non-array', async () => {
      restoreFetch = mockFetch({
        [`/api/v1/crm/campaigns?workspaceId=${WORKSPACE_ID}`]: {
          body: { campaigns: [] }, // API returns object instead of array
        },
      });

      const { result } = renderHook(
        () => useCampaigns({ workspaceId: WORKSPACE_ID }),
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    test('does not fetch when disabled', () => {
      restoreFetch = mockFetch({});

      const { result } = renderHook(
        () => useCampaigns({ workspaceId: WORKSPACE_ID, enabled: false }),
        { wrapper: createTestWrapper() }
      );

      expect(result.current.isFetching).toBe(false);
    });

    test('does not fetch when workspaceId is empty', () => {
      restoreFetch = mockFetch({});

      const { result } = renderHook(
        () => useCampaigns({ workspaceId: '' }),
        { wrapper: createTestWrapper() }
      );

      expect(result.current.isFetching).toBe(false);
    });

    test('throws on API error', async () => {
      restoreFetch = mockFetch({
        [`/api/v1/crm/campaigns?workspaceId=${WORKSPACE_ID}`]: {
          status: 500,
          ok: false,
          body: 'Internal Server Error',
        },
      });

      const { result } = renderHook(
        () => useCampaigns({ workspaceId: WORKSPACE_ID }),
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toContain('Failed to fetch campaigns');
    });
  });

  describe('useCampaign (single)', () => {
    test('fetches single campaign by ID', async () => {
      restoreFetch = mockFetch({
        [`/api/v1/crm/campaigns/${CAMPAIGN_ID}?workspaceId=${WORKSPACE_ID}`]: {
          body: sampleCampaign,
        },
      });

      const { result } = renderHook(
        () => useCampaign(CAMPAIGN_ID, WORKSPACE_ID),
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.name).toBe('Test Campaign');
    });
  });

  describe('useCreateCampaign', () => {
    test('sends POST with correct URL and body', async () => {
      const { requests, restore } = mockFetchWithCapture({
        body: { ...sampleCampaign, id: 'new-camp-id' },
      });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useCreateCampaign(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        workspaceId: WORKSPACE_ID,
        name: 'New Campaign',
        type: 'one_time',
        channel: 'email',
      } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq).toBeDefined();
      expect(postReq!.url).toBe(`/api/v1/crm/campaigns?workspaceId=${WORKSPACE_ID}`);
      expect(postReq!.url).not.toContain('/workspaces/');
      expect(postReq!.body.name).toBe('New Campaign');
    });

    test('handles creation failure', async () => {
      restoreFetch = mockFetch({
        [`POST /api/v1/crm/campaigns?workspaceId=${WORKSPACE_ID}`]: {
          status: 400,
          ok: false,
          body: 'Campaign name is required',
        },
      });

      const { result } = renderHook(
        () => useCreateCampaign(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        workspaceId: WORKSPACE_ID,
        name: '',
        type: 'one_time',
        channel: 'email',
      } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useDeleteCampaign', () => {
    test('sends DELETE to correct URL', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { success: true } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useDeleteCampaign(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const deleteReq = requests.find(r => r.method === 'DELETE');
      expect(deleteReq).toBeDefined();
      expect(deleteReq!.url).toContain(`/api/v1/crm/campaigns/${CAMPAIGN_ID}`);
      expect(deleteReq!.url).toContain(`workspaceId=${WORKSPACE_ID}`);
    });
  });

  describe('useActivateCampaign', () => {
    test('sends POST to correct URL with workspaceId as query param', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { status: 'active' } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useActivateCampaign(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID,
        userId: 'user-1',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq!.url).toBe(
        `/api/v1/crm/campaigns/${CAMPAIGN_ID}/activate?workspaceId=${WORKSPACE_ID}`
      );
      expect(postReq!.url).not.toContain('/workspaces/');
    });
  });

  describe('usePauseCampaign', () => {
    test('sends POST to correct URL with workspaceId as query param', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { status: 'paused' } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => usePauseCampaign(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID,
        userId: 'user-1',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq!.url).toBe(
        `/api/v1/crm/campaigns/${CAMPAIGN_ID}/pause?workspaceId=${WORKSPACE_ID}`
      );
      expect(postReq!.url).not.toContain('/workspaces/');
    });
  });

  describe('useResumeCampaign', () => {
    test('sends POST to correct URL with workspaceId as query param', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { status: 'active' } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useResumeCampaign(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID,
        userId: 'user-1',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq!.url).toBe(
        `/api/v1/crm/campaigns/${CAMPAIGN_ID}/resume?workspaceId=${WORKSPACE_ID}`
      );
      expect(postReq!.url).not.toContain('/workspaces/');
    });
  });

  describe('useCancelCampaign', () => {
    test('sends POST to correct URL with workspaceId as query param', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { status: 'cancelled' } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useCancelCampaign(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID,
        userId: 'user-1',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq!.url).toBe(
        `/api/v1/crm/campaigns/${CAMPAIGN_ID}/cancel?workspaceId=${WORKSPACE_ID}`
      );
      expect(postReq!.url).not.toContain('/workspaces/');
    });
  });
});
