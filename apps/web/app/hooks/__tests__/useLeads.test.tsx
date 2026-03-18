/// <reference lib="dom" />

/**
 * useLeads Hook Tests
 *
 * Validates API URL correctness for lead mutation operations.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { createDataRouterWrapper, mockFetchWithCapture } from './test-utils';
import { useConvertLead } from '../useLeads';

const WORKSPACE_ID = 'ws-test-123';
const LEAD_ID = 'lead-test-789';

describe('useLeads — URL correctness', () => {
  let restoreFetch: () => void;

  afterEach(() => {
    if (restoreFetch) restoreFetch();
  });

  describe('useConvertLead', () => {
    test('sends POST with workspaceId as query param', async () => {
      const { requests, restore } = mockFetchWithCapture({
        body: { contactId: 'contact-1', accountId: 'account-1' },
      });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useConvertLead(),
        { wrapper: createDataRouterWrapper() }
      );

      result.current.mutate({
        leadId: LEAD_ID,
        data: {
          workspaceId: WORKSPACE_ID,
          userId: 'user-1',
          createContact: true,
          createAccount: true,
          createOpportunity: false,
        },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq).toBeDefined();
      expect(postReq!.url).toBe(
        `/api/v1/crm/leads/${LEAD_ID}/convert?workspaceId=${WORKSPACE_ID}`
      );
      expect(postReq!.url).not.toContain('/workspaces/');
    });
  });
});
