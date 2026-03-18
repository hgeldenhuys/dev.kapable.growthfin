/**
 * Consent Routes (STUB IMPLEMENTATION)
 * REST endpoints for POPIA consent operations
 *
 * NOTE: Database tables for consent records have not been created yet.
 * This is a stub implementation that returns empty data to prevent 404 errors
 * in the frontend.
 */

import { Elysia, t } from 'elysia';
import { complianceService } from '../services/compliance';

export const consentRoutes = new Elysia({ prefix: '/consent' })
  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400; // Default 24 hours
      const consent = await complianceService.getRecentConsent(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
        consentRecords: consent,
        data: consent,
        _meta: {
          count: consent.length,
          workspaceId: query.workspaceId,
        },
      };
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        seconds: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Consent'],
        summary: 'Get recent consent records',
        description: 'Fetch recent consent records for initial state (CQRS pattern). NOTE: Stub implementation - returns empty array.',
      },
    }
  )
  .get(
    '/',
    async ({ db, query }) => {
      return complianceService.listConsent(db, {
        workspaceId: query.workspaceId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        contactId: query.contactId,
        consentType: query.consentType,
        status: query.status,
      });
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
        consentType: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Consent'],
        summary: 'List consent records',
        description: 'List consent records with filters. NOTE: Stub implementation - returns empty array.',
      },
    }
  )
  .get(
    '/:id',
    async ({ db, params, query }) => {
      const consent = await complianceService.getConsentById(db, params.id, query.workspaceId);
      if (!consent) {
        throw new Error('Consent record not found');
      }
      return consent;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Consent'],
        summary: 'Get consent record by ID',
        description: 'Get a single consent record. NOTE: Stub implementation - returns null.',
      },
    }
  )
  .post(
    '/',
    async ({ db, body }) => {
      return complianceService.createConsent(db, body);
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        contactId: t.String(),
        consentType: t.String(),
        status: t.String(),
        version: t.String(),
        source: t.String(),
        grantedAt: t.Optional(t.String()),
        withdrawnAt: t.Optional(t.String()),
        expiresAt: t.Optional(t.String()),
        ipAddress: t.Optional(t.String()),
        metadata: t.Optional(t.Any()),
      }),
      detail: {
        tags: ['Consent'],
        summary: 'Create consent record',
        description: 'Create a new consent record. NOTE: Stub implementation - throws error.',
      },
    }
  )
  .put(
    '/:id',
    async ({ db, params, query, body }) => {
      const consent = await complianceService.updateConsent(db, params.id, query.workspaceId, body);
      if (!consent) {
        throw new Error('Consent record not found');
      }
      return consent;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        status: t.Optional(t.String()),
        withdrawnAt: t.Optional(t.String()),
        metadata: t.Optional(t.Any()),
      }),
      detail: {
        tags: ['Consent'],
        summary: 'Update consent record',
        description: 'Update a consent record. NOTE: Stub implementation - returns null.',
      },
    }
  )
  .delete(
    '/:id',
    async ({ db, params, query }) => {
      await complianceService.deleteConsent(db, params.id, query.workspaceId);
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Consent'],
        summary: 'Delete consent record',
        description: 'Delete a consent record. NOTE: Stub implementation - throws error.',
      },
    }
  )
  .get(
    '/contact/:contactId',
    async ({ db, params, query }) => {
      return complianceService.getConsentByContact(db, params.contactId, query.workspaceId);
    },
    {
      params: t.Object({ contactId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['Consent'],
        summary: 'Get consent records by contact',
        description: 'Get all consent records for a contact. NOTE: Stub implementation - returns empty array.',
      },
    }
  );
