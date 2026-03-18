/// <reference lib="dom" />

/**
 * useCampaignScheduling Hook Tests
 *
 * Validates that all API URLs use the correct flat route pattern
 * matching the backend routes:
 *   /api/v1/crm/campaign-schedules
 *   /api/v1/crm/campaign-recurrences
 *   /api/v1/crm/campaign-triggers
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper, mockFetchWithCapture } from './test-utils';
import {
  useScheduledCampaigns,
  useCampaignSchedule,
  useScheduleCampaign,
  useCancelSchedule,
  useCreateRecurrence,
  usePauseRecurrence,
  useResumeRecurrence,
  useCampaignTriggers,
  useCreateTrigger,
  useDeleteTrigger,
} from '../useCampaignScheduling';

const WORKSPACE_ID = 'ws-test-123';
const CAMPAIGN_ID = 'camp-test-456';
const SCHEDULE_ID = 'sched-test-789';
const RECURRENCE_ID = 'rec-test-345';
const TRIGGER_ID = 'trig-test-012';
const USER_ID = 'user-test-001';

describe('useCampaignScheduling — URL correctness (flat routes)', () => {
  let restoreFetch: () => void;

  afterEach(() => {
    if (restoreFetch) restoreFetch();
  });

  describe('useScheduledCampaigns', () => {
    test('uses flat /campaign-schedules route', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { schedules: [] } });
      restoreFetch = restore;

      renderHook(
        () => useScheduledCampaigns(WORKSPACE_ID),
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => requests.length > 0);

      expect(requests[0].url).toBe(`/api/v1/crm/campaign-schedules?workspaceId=${WORKSPACE_ID}`);
      expect(requests[0].url).not.toContain('/campaigns/');
    });
  });

  describe('useCampaignSchedule', () => {
    test('uses flat /campaign-schedules/:id route', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: null });
      restoreFetch = restore;

      renderHook(
        () => useCampaignSchedule(SCHEDULE_ID, WORKSPACE_ID),
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => requests.length > 0);

      expect(requests[0].url).toBe(
        `/api/v1/crm/campaign-schedules/${SCHEDULE_ID}?workspaceId=${WORKSPACE_ID}`
      );
    });
  });

  describe('useScheduleCampaign', () => {
    test('sends POST to flat /campaign-schedules route with userId', async () => {
      const { requests, restore } = mockFetchWithCapture({
        body: { scheduleId: SCHEDULE_ID, status: 'scheduled' },
      });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useScheduleCampaign(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        scheduledAt: '2026-03-01T10:00:00Z',
        timezone: 'Africa/Johannesburg',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq).toBeDefined();
      expect(postReq!.url).toBe(
        `/api/v1/crm/campaign-schedules?workspaceId=${WORKSPACE_ID}`
      );
      expect(postReq!.url).not.toContain(`/campaigns/`);
    });
  });

  describe('useCancelSchedule', () => {
    test('sends DELETE to flat /campaign-schedules/:id route with userId', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { success: true } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useCancelSchedule(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        scheduleId: SCHEDULE_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const deleteReq = requests.find(r => r.method === 'DELETE');
      expect(deleteReq).toBeDefined();
      expect(deleteReq!.url).toBe(
        `/api/v1/crm/campaign-schedules/${SCHEDULE_ID}?workspaceId=${WORKSPACE_ID}`
      );
    });
  });

  describe('useCreateRecurrence', () => {
    test('sends POST to flat /campaign-recurrences route with userId', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { id: 'rec-1' } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useCreateRecurrence(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        pattern: 'daily',
        time: '09:00',
        timezone: 'Africa/Johannesburg',
        endCondition: 'never',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq!.url).toBe(
        `/api/v1/crm/campaign-recurrences?workspaceId=${WORKSPACE_ID}`
      );
      expect(postReq!.url).not.toContain(`/campaigns/`);
    });
  });

  describe('usePauseRecurrence', () => {
    test('sends PATCH to flat /campaign-recurrences/:id/pause route', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { paused: true } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => usePauseRecurrence(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        recurrenceId: RECURRENCE_ID,
        workspaceId: WORKSPACE_ID,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const patchReq = requests.find(r => r.method === 'PATCH');
      expect(patchReq!.url).toBe(
        `/api/v1/crm/campaign-recurrences/${RECURRENCE_ID}/pause?workspaceId=${WORKSPACE_ID}`
      );
    });
  });

  describe('useResumeRecurrence', () => {
    test('sends PATCH to flat /campaign-recurrences/:id/resume route', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { resumed: true } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useResumeRecurrence(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        recurrenceId: RECURRENCE_ID,
        workspaceId: WORKSPACE_ID,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const patchReq = requests.find(r => r.method === 'PATCH');
      expect(patchReq!.url).toBe(
        `/api/v1/crm/campaign-recurrences/${RECURRENCE_ID}/resume?workspaceId=${WORKSPACE_ID}`
      );
    });
  });

  describe('useCampaignTriggers', () => {
    test('fetches from flat /campaign-triggers route', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { triggers: [] } });
      restoreFetch = restore;

      renderHook(
        () => useCampaignTriggers(CAMPAIGN_ID, WORKSPACE_ID),
        { wrapper: createTestWrapper() }
      );

      await waitFor(() => requests.length > 0);

      expect(requests[0].url).toBe(
        `/api/v1/crm/campaign-triggers?workspaceId=${WORKSPACE_ID}&campaignId=${CAMPAIGN_ID}`
      );
      expect(requests[0].url).not.toContain('/campaigns/');
    });
  });

  describe('useCreateTrigger', () => {
    test('sends POST to flat /campaign-triggers route with userId', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { id: 'trig-new' } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useCreateTrigger(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        name: 'Test Trigger',
        triggerEvent: 'lead_created',
        conditions: { logic: 'and', conditions: [] },
        maxTriggersPerDay: 100,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq!.url).toBe(
        `/api/v1/crm/campaign-triggers?workspaceId=${WORKSPACE_ID}`
      );
    });
  });

  describe('useDeleteTrigger', () => {
    test('sends DELETE to flat /campaign-triggers/:id route', async () => {
      const { requests, restore } = mockFetchWithCapture({ body: { success: true } });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useDeleteTrigger(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        triggerId: TRIGGER_ID,
        campaignId: CAMPAIGN_ID,
        workspaceId: WORKSPACE_ID,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const deleteReq = requests.find(r => r.method === 'DELETE');
      expect(deleteReq!.url).toBe(
        `/api/v1/crm/campaign-triggers/${TRIGGER_ID}?workspaceId=${WORKSPACE_ID}`
      );
    });
  });
});
