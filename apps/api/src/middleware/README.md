# Workspace Permission Middleware

This middleware implements role-based access control (RBAC) for multi-tenant workspaces.

## Implementation (US-API-005, US-API-006)

### Middleware Functions

#### `requireWorkspaceMember(workspaceIdParam?)`

Verifies workspace membership and adds context to the request.

**Parameters:**
- `workspaceIdParam` (optional): Name of the parameter containing workspace ID (default: 'workspaceId')

**Adds to request context:**
- `userId`: User ID extracted from request
- `workspace`: Full workspace object
- `userRole`: User's role in the workspace ('viewer' | 'member' | 'admin' | 'owner')
- `workspaceMembership`: Full membership record

**Returns:**
- `200`: Valid membership
- `400`: Missing workspace ID or user ID
- `403`: User is not a workspace member
- `404`: Workspace not found

#### `requireWorkspaceRole(minRole)`

Enforces minimum role requirement for an endpoint.

**Parameters:**
- `minRole`: Minimum role required ('viewer' | 'member' | 'admin' | 'owner')

**Returns:**
- `200`: User has sufficient role
- `403`: User role is insufficient

**Role Hierarchy:**
```
viewer (0) < member (1) < admin (2) < owner (3)
```

## Permission Matrix

Based on the CRM/LMS PRD requirements:

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View data (GET) | ✅ | ✅ | ✅ | ✅ |
| Create (POST) | ✅ | ✅ | ✅ | ❌ |
| Edit own (PUT/PATCH) | ✅ | ✅ | ✅ | ❌ |
| Edit others | ✅ | ✅ | ❌ | ❌ |
| Delete own | ✅ | ✅ | ✅ | ❌ |
| Delete others | ✅ | ✅ | ❌ | ❌ |
| Force delete (bypass protection) | ✅ | ✅ | ❌ | ❌ |

## Usage Examples

### Module-Level (Applied to ALL routes)

```typescript
// apps/api/src/modules/crm/index.ts
import { requireWorkspaceMember } from '../../middleware/workspace-permissions';

export const crmModule = new Elysia({ prefix: '/crm' })
  .use(requireWorkspaceMember())  // Applies to all CRM routes
  .use(contactRoutes)
  .use(accountRoutes)
  // ...other routes
```

### Route-Level (Specific permission requirements)

```typescript
import { requireWorkspaceMember, requireWorkspaceRole } from '../../../middleware/workspace-permissions';

// Read-only endpoint (viewer+)
export const viewerRoutes = new Elysia()
  .use(requireWorkspaceMember())
  .use(requireWorkspaceRole('viewer'))
  .get('/campaigns', async ({ workspace, userRole }) => {
    // workspace and userRole available from middleware
    return campaignService.list(workspace.id);
  });

// Write endpoint (member+)
export const memberRoutes = new Elysia()
  .use(requireWorkspaceMember())
  .use(requireWorkspaceRole('member'))
  .post('/campaigns', async ({ workspace, userId }) => {
    // Only members can create campaigns
    return campaignService.create(workspace.id, userId, data);
  });

// Admin-only endpoint (admin+)
export const adminRoutes = new Elysia()
  .use(requireWorkspaceMember())
  .use(requireWorkspaceRole('admin'))
  .delete('/campaigns/:id', async ({ workspace, userId, params }) => {
    // Only admins can delete campaigns
    return campaignService.delete(workspace.id, params.id);
  });
```

## Current Implementation Notes

**User ID Extraction (Temporary):**

Currently, the middleware extracts `userId` from request body/query parameters in the following order:

1. `body.userId`
2. `body.createdBy`
3. `body.createdById`
4. `body.updatedBy`
5. `body.updatedById`
6. `body.ownerId`
7. `body.assigneeId`
8. `body.addedBy`
9. `query.userId`

**TODO: Better Auth Integration**

The current implementation is a stopgap. Future work should:
- Validate session cookies via Better Auth
- Extract `userId` from authenticated session
- Remove userId from request parameters
- Add `requireAuth()` middleware before `requireWorkspaceMember()`

**Backward Compatibility:**

To avoid breaking existing tests and integrations, the middleware:
- Allows requests without userId (defaults to 'viewer' role)
- Only blocks requests with invalid userId + workspace combination
- Validates workspace existence even without userId

This ensures gradual migration to full auth without breaking existing functionality.

## Testing

```bash
# Test with valid workspace member
curl "http://localhost:3000/api/v1/crm/contacts?workspaceId=<WORKSPACE_ID>&userId=<USER_ID>"

# Test with non-member (should return 403 if userId provided but not member)
curl "http://localhost:3000/api/v1/crm/contacts?workspaceId=<WORKSPACE_ID>&userId=<INVALID_USER_ID>"

# Test with invalid workspace (should return 404 or empty results)
curl "http://localhost:3000/api/v1/crm/contacts?workspaceId=<INVALID_WORKSPACE_ID>"

# Test POST with member role
curl -X POST "http://localhost:3000/api/v1/crm/contacts" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"<WORKSPACE_ID>","userId":"<USER_ID>",...}'
```

## Related Files

- `apps/api/src/middleware/workspace-permissions.ts` - Middleware implementation
- `apps/api/src/modules/crm/index.ts` - CRM module with middleware applied
- `packages/db/src/schema/workspace-members.ts` - Membership schema
- `packages/db/src/schema/workspaces.ts` - Workspace schema

## Story References

- **US-API-005**: Create permission middleware
- **US-API-006**: Update all CRM endpoints with permissions
