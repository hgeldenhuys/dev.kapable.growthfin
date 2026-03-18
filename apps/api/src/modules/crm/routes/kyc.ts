/**
 * KYC Routes (STUB IMPLEMENTATION)
 * REST endpoints for FICA KYC operations
 *
 * NOTE: Database tables for KYC records have not been created yet.
 * This is a stub implementation that returns empty data to prevent 404 errors
 * in the frontend.
 */

import { Elysia, t } from 'elysia';
import { complianceService } from '../services/compliance';

export const kycRoutes = new Elysia({ prefix: '/kyc' })
  .get(
    '/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400; // Default 24 hours
      const kyc = await complianceService.getRecentKYC(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
        kycRecords: kyc,
        data: kyc,
        _meta: {
          count: kyc.length,
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
        tags: ['KYC'],
        summary: 'Get recent KYC records',
        description: 'Fetch recent KYC records for initial state (CQRS pattern). NOTE: Stub implementation - returns empty array.',
      },
    }
  )
  .get(
    '/',
    async ({ db, query }) => {
      return complianceService.listKYC(db, {
        workspaceId: query.workspaceId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
        contactId: query.contactId,
        status: query.status,
        riskRating: query.riskRating,
      });
    },
    {
      query: t.Object({
        workspaceId: t.String(),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        contactId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        riskRating: t.Optional(t.String()),
      }),
      detail: {
        tags: ['KYC'],
        summary: 'List KYC records',
        description: 'List KYC records with filters. NOTE: Stub implementation - returns empty array.',
      },
    }
  )
  .get(
    '/:id',
    async ({ db, params, query }) => {
      const kyc = await complianceService.getKYCById(db, params.id, query.workspaceId);
      if (!kyc) {
        throw new Error('KYC record not found');
      }
      return kyc;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['KYC'],
        summary: 'Get KYC record by ID',
        description: 'Get a single KYC record. NOTE: Stub implementation - returns null.',
      },
    }
  )
  .post(
    '/',
    async ({ db, body }) => {
      return complianceService.createKYC(db, body);
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        contactId: t.String(),
        createdById: t.String(),
        updatedById: t.String(),
        status: t.Optional(t.String()),
        riskRating: t.Optional(t.String()),
        dueDiligenceType: t.Optional(t.String()),
        idVerified: t.Optional(t.Boolean()),
        idNumber: t.Optional(t.String()),
        idType: t.Optional(t.String()),
        idDocumentPath: t.Optional(t.String()),
        proofOfAddressVerified: t.Optional(t.Boolean()),
        proofOfAddressDocumentPath: t.Optional(t.String()),
        sourceOfFunds: t.Optional(t.String()),
        sourceOfWealth: t.Optional(t.String()),
        ficaDueDiligenceDate: t.Optional(t.String()),
        enhancedDdRequired: t.Optional(t.Boolean()),
        ongoingMonitoringFrequency: t.Optional(t.Number()),
        beneficialOwners: t.Optional(t.Any()),
        metadata: t.Optional(t.Any()),
      }),
      detail: {
        tags: ['KYC'],
        summary: 'Create KYC record',
        description: 'Create a new KYC record. NOTE: Stub implementation - throws error.',
      },
    }
  )
  .put(
    '/:id',
    async ({ db, params, query, body }) => {
      const kyc = await complianceService.updateKYC(db, params.id, query.workspaceId, body);
      if (!kyc) {
        throw new Error('KYC record not found');
      }
      return kyc;
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      body: t.Object({
        status: t.Optional(t.String()),
        riskRating: t.Optional(t.String()),
        dueDiligenceType: t.Optional(t.String()),
        idVerified: t.Optional(t.Boolean()),
        idNumber: t.Optional(t.String()),
        idType: t.Optional(t.String()),
        proofOfAddressVerified: t.Optional(t.Boolean()),
        sourceOfFunds: t.Optional(t.String()),
        sourceOfWealth: t.Optional(t.String()),
        ficaDueDiligenceDate: t.Optional(t.String()),
        enhancedDdRequired: t.Optional(t.Boolean()),
        beneficialOwners: t.Optional(t.Any()),
        updatedById: t.String(),
        metadata: t.Optional(t.Any()),
      }),
      detail: {
        tags: ['KYC'],
        summary: 'Update KYC record',
        description: 'Update a KYC record. NOTE: Stub implementation - returns null.',
      },
    }
  )
  .delete(
    '/:id',
    async ({ db, params, query }) => {
      await complianceService.deleteKYC(db, params.id, query.workspaceId);
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['KYC'],
        summary: 'Delete KYC record',
        description: 'Delete a KYC record. NOTE: Stub implementation - throws error.',
      },
    }
  )
  .get(
    '/contact/:contactId',
    async ({ db, params, query }) => {
      const kyc = await complianceService.getKYCByContact(db, params.contactId, query.workspaceId);
      if (!kyc) {
        throw new Error('KYC record not found for contact');
      }
      return kyc;
    },
    {
      params: t.Object({ contactId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
      detail: {
        tags: ['KYC'],
        summary: 'Get KYC record by contact',
        description: 'Get the KYC record for a contact. NOTE: Stub implementation - returns null.',
      },
    }
  );
