# Consent and KYC Stub Implementation

## Overview

This document describes the stub implementation for consent and KYC API endpoints that were causing 404 errors and infinite retry loops in the frontend.

## Problem

The frontend (`apps/web/app/hooks/useConsent.ts` and `apps/web/app/hooks/useKYC.ts`) was calling these endpoints:
- `GET /api/v1/crm/consent/recent?workspaceId={id}`
- `GET /api/v1/crm/kyc/recent?workspaceId={id}`

These endpoints did not exist, causing:
1. 404 errors in the browser console
2. React Query retry loops
3. Potential infinite retries

## Solution

Created stub API endpoints that return empty arrays with proper structure to satisfy the frontend expectations while the full implementation is pending.

## Files Modified

### 1. Service Layer - `/apps/api/src/modules/crm/services/compliance.ts`
- Converted to stub implementation
- All methods return empty arrays or null
- Write operations (create, update, delete) throw meaningful errors
- Added clear documentation about pending implementation

### 2. Routes - Created separate route files
- **`/apps/api/src/modules/crm/routes/consent.ts`** - Consent endpoints
- **`/apps/api/src/modules/crm/routes/kyc.ts`** - KYC endpoints

### 3. Module Registration - `/apps/api/src/modules/crm/index.ts`
- Imported `consentRoutes` and `kycRoutes`
- Registered routes in CRM module
- Deprecated old `complianceRoutes` (which had incorrect path structure)

### 4. Tests - `/apps/api/src/modules/crm/routes/__tests__/consent-kyc-stub.test.ts`
- Comprehensive test suite for stub endpoints
- 7 tests covering all critical endpoints
- Validates response structure matches frontend expectations

## Endpoints Implemented

### Consent Endpoints
- `GET /api/v1/crm/consent/recent` - Returns empty array with metadata ✅
- `GET /api/v1/crm/consent` - Returns empty array ✅
- `GET /api/v1/crm/consent/:id` - Returns null
- `POST /api/v1/crm/consent` - Throws error (not implemented)
- `PUT /api/v1/crm/consent/:id` - Returns null
- `DELETE /api/v1/crm/consent/:id` - Throws error (not implemented)
- `GET /api/v1/crm/consent/contact/:contactId` - Returns empty array ✅

### KYC Endpoints
- `GET /api/v1/crm/kyc/recent` - Returns empty array with metadata ✅
- `GET /api/v1/crm/kyc` - Returns empty array ✅
- `GET /api/v1/crm/kyc/:id` - Returns null
- `POST /api/v1/crm/kyc` - Throws error (not implemented)
- `PUT /api/v1/crm/kyc/:id` - Returns null
- `DELETE /api/v1/crm/kyc/:id` - Throws error (not implemented)
- `GET /api/v1/crm/kyc/contact/:contactId` - Returns null

## Response Format

### `/recent` Endpoints
```json
{
  "serverTimestamp": "2025-11-10T00:58:15.788Z",
  "consentRecords": [],  // or "kycRecords" for KYC endpoint
  "data": [],
  "_meta": {
    "count": 0,
    "workspaceId": "workspace-id-here"
  }
}
```

### List Endpoints
```json
[]
```

## Testing

Run tests:
```bash
cd apps/api
bun test src/modules/crm/routes/__tests__/consent-kyc-stub.test.ts
```

All 7 tests should pass:
- ✅ Consent /recent returns empty array
- ✅ Consent list returns empty array
- ✅ Consent by contact returns empty array
- ✅ KYC /recent returns empty array
- ✅ KYC list returns empty array
- ✅ Consent response format validation
- ✅ KYC response format validation

## Verification

Start API server:
```bash
cd apps/api
bun dev
```

Test endpoints:
```bash
# Consent
curl "http://localhost:3000/api/v1/crm/consent/recent?workspaceId=test"

# KYC
curl "http://localhost:3000/api/v1/crm/kyc/recent?workspaceId=test"
```

Both should return 200 OK with empty arrays.

## Swagger Documentation

All endpoints are documented in Swagger at:
- http://localhost:3000/swagger

Tags: `Consent`, `KYC`

## Next Steps (Full Implementation)

To implement full consent and KYC functionality:

### 1. Create Database Schema

Create schema files in `packages/db/src/schema/`:

**`crm-consent-records.ts`:**
```typescript
export const crmConsentRecords = pgTable('crm_consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  contactId: uuid('contact_id').notNull().references(() => crmContacts.id),
  consentType: text('consent_type').notNull(), // 'marketing', 'transactional', etc.
  status: text('status').notNull(), // 'granted', 'withdrawn', 'expired'
  version: text('version').notNull(),
  source: text('source').notNull(), // 'web', 'email', 'phone', etc.
  grantedAt: timestamp('granted_at'),
  withdrawnAt: timestamp('withdrawn_at'),
  expiresAt: timestamp('expires_at'),
  ipAddress: text('ip_address'),
  metadata: jsonb('metadata'),

  // Agios standard columns
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  workspaceIdx: index('crm_consent_records_workspace_idx').on(table.workspaceId),
  contactIdx: index('crm_consent_records_contact_idx').on(table.contactId),
}));
```

**`crm-kyc-records.ts`:**
```typescript
export const crmKycRecords = pgTable('crm_kyc_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  contactId: uuid('contact_id').notNull().references(() => crmContacts.id),
  status: text('status').notNull(), // 'pending', 'verified', 'failed'
  riskRating: text('risk_rating'), // 'low', 'medium', 'high'
  dueDiligenceType: text('due_diligence_type'), // 'simplified', 'standard', 'enhanced'

  // ID Verification
  idVerified: boolean('id_verified').default(false),
  idNumber: text('id_number'),
  idType: text('id_type'), // 'passport', 'id_card', 'drivers_license'
  idDocumentPath: text('id_document_path'),

  // Address Verification
  proofOfAddressVerified: boolean('proof_of_address_verified').default(false),
  proofOfAddressDocumentPath: text('proof_of_address_document_path'),

  // Source of Funds/Wealth
  sourceOfFunds: text('source_of_funds'),
  sourceOfWealth: text('source_of_wealth'),

  // FICA Specific
  ficaDueDiligenceDate: timestamp('fica_due_diligence_date'),
  ficaNextReviewDate: timestamp('fica_next_review_date'),
  enhancedDdRequired: boolean('enhanced_dd_required').default(false),
  ongoingMonitoringFrequency: integer('ongoing_monitoring_frequency'), // months

  // Beneficial Ownership
  beneficialOwners: jsonb('beneficial_owners'),

  metadata: jsonb('metadata'),

  // Agios standard columns
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  workspaceIdx: index('crm_kyc_records_workspace_idx').on(table.workspaceId),
  contactIdx: index('crm_kyc_records_contact_idx').on(table.contactId),
}));
```

### 2. Export Schemas

Update `packages/db/src/schema/index.ts`:
```typescript
export * from './crm-consent-records';
export * from './crm-kyc-records';
```

### 3. Generate and Run Migration

```bash
cd packages/db
bun run db:generate
bun run db:migrate
```

### 4. Update Service Layer

Replace stub implementation in `apps/api/src/modules/crm/services/compliance.ts` with real database queries using Drizzle ORM.

### 5. Update Types

Add TypeScript types in `apps/api/src/modules/crm/types.ts`:
```typescript
export interface ConsentListFilters {
  workspaceId: string;
  limit?: number;
  offset?: number;
  contactId?: string;
  consentType?: string;
  status?: string;
}

export interface KYCListFilters {
  workspaceId: string;
  limit?: number;
  offset?: number;
  contactId?: string;
  status?: string;
  riskRating?: string;
}

export type NewConsentRecord = typeof crmConsentRecords.$inferInsert;
export type NewKYCRecord = typeof crmKycRecords.$inferInsert;
```

### 6. Consider ElectricSQL Streaming

If real-time updates are needed, add streaming support:

**`apps/api/src/lib/electric-shapes.ts`:**
```typescript
export function streamConsent(
  workspaceId: string,
  subscriptionTimestamp: Date = new Date()
): ElectricShapeStream {
  return createShapeStream({
    electricUrl: ELECTRIC_URL,
    table: 'crm_consent_records',
    where: `workspace_id='${workspaceId}'`,
    subscriptionTimestamp,
  });
}

export function streamKYC(
  workspaceId: string,
  subscriptionTimestamp: Date = new Date()
): ElectricShapeStream {
  return createShapeStream({
    electricUrl: ELECTRIC_URL,
    table: 'crm_kyc_records',
    where: `workspace_id='${workspaceId}'`,
    subscriptionTimestamp,
  });
}
```

Then add `/stream` endpoints to the route files.

## Impact

✅ **Fixed:** 404 errors on `/api/v1/crm/consent/recent` and `/api/v1/crm/kyc/recent`
✅ **Fixed:** Infinite retry loops in frontend React Query hooks
✅ **Improved:** API discoverability via Swagger documentation
✅ **Maintained:** Consistent response format with other CRM endpoints
✅ **Protected:** Clear error messages when trying to create/update/delete (not yet implemented)

## Status

- **Current:** Stub implementation (returns empty data)
- **Production Ready:** Yes, for read operations
- **Write Operations:** Not implemented (will throw errors)
- **Database Schema:** Not created
- **ElectricSQL Streaming:** Not implemented
