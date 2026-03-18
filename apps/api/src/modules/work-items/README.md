# Work Items Module

Work item management for batch/task semantic separation (US-014).

## Overview

The WorkItems module provides CRUD operations and lifecycle management for work items that represent atomic units of work extracted from batches. This enables proper semantic separation between batch planning (what to do) and task execution (doing it).

## Features

- **CRUD Operations**: Create, read, update, delete work items
- **Claiming**: Atomic claim/unclaim with conflict detection (409 on double-claim)
- **Completion**: Mark items complete with result storage
- **Filtering**: Query by status, entity type, entity ID, assigned user
- **Expiration Queries**: Find expired items using `status=expired` filter
- **SSE Streaming**: Real-time updates via ElectricSQL
- **Type Handlers**: Extensible pattern for work item type-specific logic

## Architecture

```
work-items/
├── services/
│   └── work-items.service.ts    # Business logic (WorkItemsService class)
├── routes/
│   └── work-items.routes.ts     # ElysiaJS REST endpoints
├── handlers/
│   ├── base.ts                  # WorkItemTypeHandler interface
│   ├── lead-conversion.ts       # Handler for lead_conversion type
│   └── index.ts                 # Handler registry
└── index.ts                     # Module export
```

## API Endpoints

All endpoints under `/api/v1/work-items`:

### CRUD Operations

- `POST /` - Create work item
- `GET /` - List work items (with filters)
- `GET /:id` - Get work item by ID
- `PUT /:id` - Update work item
- `DELETE /:id` - Soft delete work item

### Lifecycle Operations

- `POST /:id/claim` - Claim work item (returns 409 if already claimed)
- `POST /:id/unclaim` - Release claimed work item
- `POST /:id/complete` - Mark complete with result data

### Streaming

- SSE streaming via `/api/v1/stream?table=work_items&where=workspace_id='...'`

## Query Parameters

### List Endpoint

```
GET /api/v1/work-items?workspaceId={uuid}&status={status}&entityType={type}...
```

**Filters:**
- `workspaceId` (required) - Workspace isolation
- `status` - Filter by status (supports `expired` for expired items)
- `entityType` - Filter by entity type (lead, contact, opportunity, account)
- `entityId` - Filter by specific entity
- `assignedTo` - Filter by assigned user
- `workItemType` - Filter by work item type
- `limit` - Page size (default 50)
- `offset` - Pagination offset

**Special Status:**
- `status=expired` - Returns items where `expiresAt < NOW()` and status NOT IN ('completed', 'cancelled')

## Work Item Types

Registered types:
- `lead_conversion` - Convert lead to contact/opportunity
- `follow_up` - Follow up with prospect
- `review` - Review item
- `qualification` - Qualify lead

## Type Handler Pattern

Add new work item types by implementing `WorkItemTypeHandler`:

```typescript
import type { WorkItemTypeHandler } from '../handlers/base';

export const myCustomHandler: WorkItemTypeHandler = {
  type: 'my_custom_type',

  validateMetadata(metadata: any) {
    // Validate metadata structure
    return { valid: true };
  },

  async execute(workItem, db) {
    // Execute work item logic
  },

  getDisplayInfo(workItem) {
    // UI display information
    return { icon: 'check', color: 'blue', subtitle: 'Custom work' };
  },
};

// Register handler
registerWorkItemTypeHandler(myCustomHandler);
```

## Database Schema

All work items include:
- Standard Agios columns (workspace_id, created_at, updated_at, etc.)
- Soft delete support (deleted_at, can_be_revived, revival_count)
- Entity reference (entity_type, entity_id)
- Assignment (assigned_to)
- Claiming (claimed_by, claimed_at)
- Completion (completed_at, completed_by, result)
- Timing (due_at, expires_at)
- Flexible metadata (JSONB)

## Testing

All endpoints tested and working:

✅ Create work item
✅ List work items
✅ Get by ID
✅ Update work item
✅ Delete work item (soft delete)
✅ Claim work item (atomic)
✅ Claim conflict detection (409)
✅ Unclaim work item
✅ Complete work item with result
✅ Filter by status
✅ SSE streaming enabled
✅ Swagger documentation

## Usage Example

```typescript
import { WorkItemsService } from '@/modules/work-items';

// Create work item
const workItem = await WorkItemsService.create(db, {
  workspaceId: '...',
  entityType: 'lead',
  entityId: 'lead-id',
  workItemType: 'lead_conversion',
  title: 'Convert high-value lead',
  priority: 10,
  metadata: {
    leadId: 'lead-id',
    conversionReason: 'Qualified',
  },
});

// Claim work item
const claimed = await WorkItemsService.claim(db, workItem.id, workspaceId, userId);

// Complete with result
const completed = await WorkItemsService.complete(
  db,
  workItem.id,
  workspaceId,
  'user',
  { contactId: '...', opportunityId: '...' }
);
```

## Integration Points

- **Batches Module**: Work items created from batch execution
- **ElectricSQL**: Real-time streaming of work item updates
- **PostgreSQL**: ACID-compliant claiming with SELECT FOR UPDATE
- **Swagger**: Full API documentation at `/swagger`

## Status

✅ **COMPLETE** - All tasks (T-049 through T-055) implemented and tested
