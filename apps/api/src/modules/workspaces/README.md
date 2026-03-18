# Workspace Module

This module handles workspace management, including invitations and member management.

## Features

### US-API-001: List User Workspaces
Returns all workspaces where the user is a member, including their role and member count.

**Endpoint**: `GET /api/v1/workspaces?userId={userId}`

**Response**:
```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "Workspace Name",
      "slug": "workspace-slug",
      "role": "owner",
      "memberCount": 5,
      "createdAt": "2025-10-28T00:00:00.000Z"
    }
  ]
}
```

### US-API-002: Get Workspace Details
Returns detailed workspace information including all members. Requires user to be a member.

**Endpoint**: `GET /api/v1/workspaces/:id?userId={userId}`

**Response**:
```json
{
  "workspace": {
    "id": "uuid",
    "name": "Workspace Name",
    "slug": "workspace-slug",
    "ownerId": "uuid",
    "settings": {},
    "createdAt": "2025-10-28T00:00:00.000Z",
    "members": [
      {
        "userId": "uuid",
        "email": "user@example.com",
        "name": "User Name",
        "role": "owner",
        "status": "active",
        "joinedAt": "2025-10-28T00:00:00.000Z"
      }
    ]
  }
}
```

### US-API-003: Workspace Invitation System

#### Send Invitation
Create a workspace invitation with a unique token that expires in 7 days.

**Endpoint**: `POST /api/v1/workspaces/:id/invitations`

**Permissions**: Requires admin or owner role

**Request**:
```json
{
  "email": "newuser@example.com",
  "role": "member",
  "invitedBy": "uuid"
}
```

**Valid Roles**: `admin`, `member`, `viewer` (cannot invite as `owner`)

**Response**:
```json
{
  "invitation": {
    "id": "uuid",
    "email": "newuser@example.com",
    "role": "member",
    "token": "unique-base64url-token",
    "expiresAt": "2025-11-04T00:00:00.000Z"
  }
}
```

**Error Responses**:
- `400` - Cannot invite as owner / Already pending invitation
- `403` - Not authorized to send invitations

#### Validate Invitation
Check if an invitation token is valid and not expired.

**Endpoint**: `GET /api/v1/workspaces/invitations/:token`

**Response**:
```json
{
  "invitation": {
    "workspaceName": "Workspace Name",
    "email": "newuser@example.com",
    "role": "member",
    "expiresAt": "2025-11-04T00:00:00.000Z"
  }
}
```

**Error Responses**:
- `404` - Invalid invitation token
- `400` - Invitation expired / Already accepted

#### Accept Invitation
Accept an invitation and join the workspace.

**Endpoint**: `POST /api/v1/workspaces/invitations/:token/accept`

**Request**:
```json
{
  "userId": "uuid"
}
```

**Response**:
```json
{
  "workspace": {
    "id": "uuid",
    "name": "Workspace Name",
    "role": "member"
  }
}
```

**Error Responses**:
- `404` - Invalid invitation token
- `400` - Invitation expired / Already accepted
- `403` - Email mismatch (invitation sent to different email)

### US-API-004: Manage Workspace Members

#### Update Member Role
Change a workspace member's role.

**Endpoint**: `PATCH /api/v1/workspaces/:id/members/:userId?requestingUserId={userId}`

**Permissions**:
- Admin/Owner can change member and viewer roles
- Only Owner can change admin roles
- Cannot change own role
- Cannot change to owner role

**Request**:
```json
{
  "role": "admin"
}
```

**Valid Roles**: `admin`, `member`, `viewer` (cannot change to `owner`)

**Response**:
```json
{
  "member": {
    "userId": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "admin",
    "status": "active"
  }
}
```

**Error Responses**:
- `400` - Cannot change to owner / Cannot change own role
- `403` - Not authorized to change roles / Only owner can change admin roles
- `404` - Member not found

#### Remove Member
Remove a member from the workspace.

**Endpoint**: `DELETE /api/v1/workspaces/:id/members/:userId?requestingUserId={userId}`

**Permissions**:
- Admin/Owner can remove members and viewers
- Only Owner can remove admins
- Cannot remove last owner

**Response**:
```json
{
  "success": true
}
```

**Error Responses**:
- `400` - Cannot remove last owner
- `403` - Not authorized to remove members / Only owner can remove admins
- `404` - Member not found

## Database Schema

### workspace_invitations
```sql
CREATE TABLE workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX workspace_invitations_token_idx ON workspace_invitations(token);
CREATE INDEX workspace_invitations_workspace_idx ON workspace_invitations(workspace_id);
CREATE INDEX workspace_invitations_email_idx ON workspace_invitations(email);
```

## Permission Matrix

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View workspace details | ✅ | ✅ | ✅ | ✅ |
| Send invitations | ✅ | ✅ | ❌ | ❌ |
| Accept invitation | ✅ | ✅ | ✅ | ✅ |
| Change member role | ✅ | ✅ | ❌ | ❌ |
| Change admin role | ✅ | ❌ | ❌ | ❌ |
| Remove member | ✅ | ✅ | ❌ | ❌ |
| Remove admin | ✅ | ❌ | ❌ | ❌ |
| Change own role | ❌ | ❌ | ❌ | ❌ |

## Security Considerations

1. **Token Generation**: Uses `crypto.randomBytes(32)` for secure token generation
2. **Expiration**: All invitations expire after 7 days
3. **Email Verification**: Accepting user's email must match invitation email
4. **Permission Checks**: All operations verify requesting user's permissions
5. **Owner Protection**: Cannot remove last owner from workspace
6. **Self-Protection**: Cannot change own role

## Testing

Run tests:
```bash
bun test src/modules/workspaces/tests/
```

Test coverage:
- ✅ Send invitations with all roles
- ✅ Validate invitation tokens
- ✅ Accept invitations
- ✅ Update member roles
- ✅ Remove members
- ✅ Permission checks for all operations
- ✅ Edge cases (expired, duplicate, invalid tokens)
- ✅ API contract validation

## Examples

### Complete Invitation Workflow

1. **Owner sends invitation**:
```bash
curl -X POST http://localhost:3000/api/v1/workspaces/{workspaceId}/invitations \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@example.com","role":"member","invitedBy":"ownerUserId"}'
```

2. **New user validates invitation**:
```bash
curl http://localhost:3000/api/v1/workspaces/invitations/{token}
```

3. **New user accepts invitation**:
```bash
curl -X POST http://localhost:3000/api/v1/workspaces/invitations/{token}/accept \
  -H "Content-Type: application/json" \
  -d '{"userId":"newUserId"}'
```

4. **Owner promotes user to admin**:
```bash
curl -X PATCH http://localhost:3000/api/v1/workspaces/{workspaceId}/members/{userId}?requestingUserId={ownerId} \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

### US-API-007: Audit Logging ✅

All workspace changes are automatically logged to the `workspace_audit_log` table for compliance and debugging.

**Automatically Logged Actions**:
- `invited_member` - When invitation is sent
- `accepted_invitation` - When invitation is accepted
- `changed_role` - When member role is updated
- `removed_member` - When member is removed

**Audit Log Structure**:
```typescript
{
  id: UUID,
  workspaceId: UUID,
  userId: UUID,  // Who performed the action
  action: string,
  resourceType: 'workspace_member',
  resourceId?: UUID,  // Target member ID (for role changes/removals)
  changes: {
    before?: { role: 'member' },  // State before change
    after?: { role: 'admin' }     // State after change
  },
  createdAt: timestamp
}
```

**Query Audit Logs**:
```sql
-- Get all workspace changes
SELECT * FROM workspace_audit_log
WHERE workspace_id = 'uuid'
ORDER BY created_at DESC;

-- Get specific member history
SELECT * FROM workspace_audit_log
WHERE workspace_id = 'uuid'
  AND resource_id = 'member-uuid'
ORDER BY created_at DESC;
```

**Service API**:
```typescript
import { logAuditEvent, AuditActions, ResourceTypes } from './audit';

await logAuditEvent(db, {
  workspaceId: 'uuid',
  userId: 'uuid',
  action: AuditActions.INVITED_MEMBER,
  resourceType: ResourceTypes.WORKSPACE_MEMBER,
  changes: {
    after: { email: 'user@example.com', role: 'member' }
  }
});
```

**Features**:
- ✅ Fire-and-forget pattern (never blocks operations)
- ✅ Append-only (immutable audit trail)
- ✅ JSONB changes field for flexible before/after tracking
- ✅ Indexed for efficient querying
- ✅ Cascades on workspace deletion

### US-API-008: Email Notifications ✅

Workspace invitations automatically trigger email notifications to invited users.

**Email Content**:
- Subject: "You've been invited to join [Workspace Name] on Agios"
- HTML formatted with professional styling
- Includes workspace name and inviter name
- Clear call-to-action button with acceptance link
- Expiry notice (7 days)
- Fallback plain text link

**Acceptance Link Format**:
```
{FRONTEND_URL}/invitations/{token}
```

**Email Template Example**:
```html
You've been invited!
John Doe has invited you to join Acme Corporation as an admin.

[Accept Invitation Button]

⏰ This invitation expires in 7 days.
```

**Environment Variables**:
```bash
RESEND_SERVER_TOKEN=re_...     # Resend API key
RESEND_FROM_EMAIL=no-reply@yourdomain.com
RESEND_FROM_NAME="Agios"
WEB_URL=http://localhost:5173  # Frontend URL for invitation links
```

**Service API**:
```typescript
import { sendInvitationEmail } from './email';

await sendInvitationEmail({
  email: 'user@example.com',
  workspaceName: 'Acme Corp',
  inviterName: 'John Doe',
  role: 'admin',
  token: 'invitation-token'
});
```

**Features**:
- ✅ Fire-and-forget pattern (never blocks invitations)
- ✅ Professional HTML email template
- ✅ Resend integration for reliable delivery
- ✅ Graceful error handling (logs but doesn't fail)
- ✅ Sanitized tags for email tracking
- ✅ Works in development (logs errors if domain not verified)

**Testing**:
```bash
# Test email service
bun test-email-notification.ts

# Will attempt to send via Resend
# If domain not verified, logs error but doesn't fail
```

## Related Stories

- **US-API-001**: List user workspaces ✅
- **US-API-002**: Get workspace details ✅
- **US-API-003**: Workspace invitation system ✅
- **US-API-004**: Manage workspace members ✅
- **US-API-007**: Audit logging ✅
- **US-API-008**: Email notifications ✅
- **US-API-005**: Global permission middleware (future)
- **US-API-006**: Frontend integration (future)
