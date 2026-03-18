/// <reference lib="dom" />

/**
 * useCampaignABTesting Hook Tests
 *
 * Validates API URL correctness and CRUD operations for A/B tests.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper, mockFetchWithCapture } from './test-utils';
import {
  useCreateABTest,
  useABTestResults,
  useEvaluateWinner,
  usePromoteWinner,
  useManualOverrideWinner,
  useABTests,
  useCampaignABTests,
} from '../useCampaignABTesting';

const WORKSPACE_ID = 'ws-test-123';
const CAMPAIGN_ID = 'camp-test-456';
const AB_TEST_ID = 'ab-test-789';

describe('useCampaignABTesting — URL correctness', () => {
  let restoreFetch: () => void;

  afterEach(() => {
    if (restoreFetch) restoreFetch();
  });

  describe('useABTests (list all)', () => {
    test('uses correct URL pattern', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { abTests: [] } });
      restoreFetch = restore;

      renderHook(
        () => useABTests(WORKSPACE_ID),
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => requests.length > 0);

      expect(requests[0].url).toBe(`/api/v1/crm/ab-tests?workspaceId=${WORKSPACE_ID}`);
      expect(requests[0].url).not.toContain('/workspaces/');
    });
  });

  describe('useCampaignABTests (per campaign)', () => {
    test('uses correct URL pattern', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { abTests: [] } });
      restoreFetch = restore;

      renderHook(
        () => useCampaignABTests(WORKSPACE_ID, CAMPAIGN_ID),
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => requests.length > 0);

      expect(requests[0].url).toBe(
        `/api/v1/crm/campaigns/${CAMPAIGN_ID}/ab-tests?workspaceId=${WORKSPACE_ID}`
      );
      expect(requests[0].url).not.toContain('/workspaces/');
    });
  });

  describe('useCreateABTest', () => {
    test('sends POST to correct URL', async () => {
      const { requests, restore } = mockFetchWithCapture({
        body: { abTestId: AB_TEST_ID, status: 'draft' },
      });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useCreateABTest(WORKSPACE_ID, CAMPAIGN_ID),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        name: 'Subject Line Test',
        evaluationMetric: 'open_rate',
        minSampleSize: 100,
        controlGroupPct: 20,
        autoPromoteWinner: true,
        variants: [
          { name: 'A', trafficPct: 50, subjectLine: 'Hello', emailContent: '<p>Hi</p>' },
          { name: 'B', trafficPct: 50, subjectLine: 'Hey there', emailContent: '<p>Hey</p>' },
        ],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq!.url).toBe(
        `/api/v1/crm/campaigns/${CAMPAIGN_ID}/ab-tests?workspaceId=${WORKSPACE_ID}`
      );
      expect(postReq!.url).not.toContain('/workspaces/');
    });
  });

  describe('useABTestResults', () => {
    test('fetches results with correct URL', async () => {
      const { requests, restore } = mockFetchWithCapture({
        body: { abTestId: AB_TEST_ID, status: 'running', variants: [] },
      });
      restoreFetch = restore;

      renderHook(
        () => useABTestResults(WORKSPACE_ID, AB_TEST_ID),
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => requests.length > 0);

      expect(requests[0].url).toBe(
        `/api/v1/crm/ab-tests/${AB_TEST_ID}/results?workspaceId=${WORKSPACE_ID}`
      );
      expect(requests[0].url).not.toContain('/workspaces/');
    });
  });

  describe('useEvaluateWinner', () => {
    test('sends POST to correct evaluate URL', async () => {
      const { requests, restore } = mockFetchWithCapture({
        body: { abTestId: AB_TEST_ID, winnerVariantId: 'v1' },
      });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useEvaluateWinner(WORKSPACE_ID, AB_TEST_ID),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq!.url).toBe(
        `/api/v1/crm/ab-tests/${AB_TEST_ID}/evaluate?workspaceId=${WORKSPACE_ID}`
      );
    });
  });

  describe('usePromoteWinner', () => {
    test('sends POST to correct promote URL', async () => {
      const { requests, restore } = mockFetchWithCapture({
        body: { promoted: true, recipientsCount: 500 },
      });
      restoreFetch = restore;

      const { result } = renderHook(
        () => usePromoteWinner(WORKSPACE_ID, AB_TEST_ID),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq!.url).toBe(
        `/api/v1/crm/ab-tests/${AB_TEST_ID}/promote?workspaceId=${WORKSPACE_ID}`
      );
    });
  });

  describe('useManualOverrideWinner', () => {
    test('sends POST to correct override URL with variantId', async () => {
      const { requests, restore } = mockFetchWithCapture({
        body: { abTestId: AB_TEST_ID, winnerVariantId: 'v2' },
      });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useManualOverrideWinner(WORKSPACE_ID, AB_TEST_ID),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate('v2');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq!.url).toBe(
        `/api/v1/crm/ab-tests/${AB_TEST_ID}/override?workspaceId=${WORKSPACE_ID}`
      );
      expect(postReq!.body.winnerVariantId).toBe('v2');
    });
  });
});
