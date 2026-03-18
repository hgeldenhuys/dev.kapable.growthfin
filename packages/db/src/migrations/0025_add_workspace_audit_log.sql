-- Migration 0025: Add Workspace Audit Log
-- Creates immutable audit log table for tracking all workspace changes

CREATE TABLE workspace_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX workspace_audit_log_workspace_idx ON workspace_audit_log(workspace_id);
CREATE INDEX workspace_audit_log_user_idx ON workspace_audit_log(user_id);
CREATE INDEX workspace_audit_log_created_at_idx ON workspace_audit_log(created_at DESC);
CREATE INDEX workspace_audit_log_resource_type_idx ON workspace_audit_log(resource_type);

-- Composite index for common query patterns (workspace + resource type + resource ID)
CREATE INDEX workspace_audit_log_workspace_resource_idx
ON workspace_audit_log(workspace_id, resource_type, resource_id);

-- Add helpful comment on the table
COMMENT ON TABLE workspace_audit_log IS 'Immutable audit log for tracking workspace changes. Stores who changed what, when, and before/after state.';
COMMENT ON COLUMN workspace_audit_log.action IS 'Action type: created, updated, deleted, invited_member, changed_role, etc.';
COMMENT ON COLUMN workspace_audit_log.resource_type IS 'Type of resource: contact, account, campaign, member, etc.';
COMMENT ON COLUMN workspace_audit_log.changes IS 'JSONB storing before/after state: {"before": {...}, "after": {...}}';
