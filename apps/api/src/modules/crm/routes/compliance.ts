/**
 * Compliance Routes
 * REST endpoints for POPIA consent and FICA KYC operations
 */

import { Elysia, t } from 'elysia';
import { complianceService } from '../services/compliance';

export const complianceRoutes = new Elysia({ prefix: '/compliance' })
  // ========================================
  // CONSENT ENDPOINTS
  // ========================================
  .get(
    '/consent/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400; // Default 24 hours
      const consent = await complianceService.getRecentConsent(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
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
        tags: ['Compliance'],
        summary: 'Get recent consent records',
        description: 'Fetch recent consent records for initial state (CQRS pattern)',
      },
    }
  )
  .get(
    '/consent',
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
    }
  )
  .post(
    '/consent',
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
    }
  )
  .get(
    '/consent/:id',
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
    }
  )
  .put(
    '/consent/:id',
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
    }
  )
  .delete(
    '/consent/:id',
    async ({ db, params, query }) => {
      await complianceService.deleteConsent(db, params.id, query.workspaceId);
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .get(
    '/consent/contact/:contactId',
    async ({ db, params, query }) => {
      return complianceService.getConsentByContact(db, params.contactId, query.workspaceId);
    },
    {
      params: t.Object({ contactId: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )

  // ========================================
  // KYC ENDPOINTS
  // ========================================
  .get(
    '/kyc/recent',
    async ({ db, query }) => {
      const seconds = query.seconds ? parseInt(query.seconds, 10) : 86400; // Default 24 hours
      const kyc = await complianceService.getRecentKYC(db, query.workspaceId, seconds);

      return {
        serverTimestamp: new Date().toISOString(),
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
        tags: ['Compliance'],
        summary: 'Get recent KYC records',
        description: 'Fetch recent KYC records for initial state (CQRS pattern)',
      },
    }
  )
  .get(
    '/kyc',
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
    }
  )
  .post(
    '/kyc',
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
    }
  )
  .get(
    '/kyc/:id',
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
    }
  )
  .put(
    '/kyc/:id',
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
    }
  )
  .delete(
    '/kyc/:id',
    async ({ db, params, query }) => {
      await complianceService.deleteKYC(db, params.id, query.workspaceId);
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ workspaceId: t.String() }),
    }
  )
  .get(
    '/kyc/contact/:contactId',
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
    }
  );
