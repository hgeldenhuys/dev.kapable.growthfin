/// <reference lib="dom" />

/**
 * useImportExport Hook Tests
 *
 * Validates API URL correctness for import/export operations.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper, mockFetchWithCapture } from './test-utils';
import { useImportContacts, useImportLeads } from '../useImportExport';

const WORKSPACE_ID = 'ws-test-123';

describe('useImportExport — URL correctness', () => {
  let restoreFetch: () => void;

  afterEach(() => {
    if (restoreFetch) restoreFetch();
  });

  describe('useImportContacts', () => {
    test('sends POST with workspaceId as query param', async () => {
      const { requests, restore } = mockFetchWithCapture({
        body: { success: true, imported: 5, failed: 0, errors: [] },
      });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useImportContacts(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        workspaceId: WORKSPACE_ID,
        ownerId: 'user-1',
        records: [
          { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        ],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq).toBeDefined();
      expect(postReq!.url).toBe(`/api/v1/crm/contacts/import?workspaceId=${WORKSPACE_ID}`);
      expect(postReq!.url).not.toContain('/workspaces/');
    });
  });

  describe('useImportLeads', () => {
    test('sends POST with workspaceId as query param', async () => {
      const { requests, restore } = mockFetchWithCapture({
        body: { success: true, imported: 3, failed: 0, errors: [] },
      });
      restoreFetch = restore;

      const { result } = renderHook(
        () => useImportLeads(),
        { wrapper: createTestWrapper() }
      );

      result.current.mutate({
        workspaceId: WORKSPACE_ID,
        ownerId: 'user-1',
        createdById: 'user-1',
        updatedById: 'user-1',
        records: [
          { name: 'Lead One', source: 'website' },
        ],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const postReq = requests.find(r => r.method === 'POST');
      expect(postReq).toBeDefined();
      expect(postReq!.url).toBe(`/api/v1/crm/leads/import?workspaceId=${WORKSPACE_ID}`);
      expect(postReq!.url).not.toContain('/workspaces/');
    });
  });
});
