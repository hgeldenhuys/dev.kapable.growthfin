-- Migration 048: Fix ON DELETE CASCADE for organization deletion
-- Several FK constraints used NO ACTION, blocking org deletion.
-- This migration updates them to CASCADE (or SET NULL where appropriate)
-- so that deleting an organization cleanly removes all dependent data.

BEGIN;

-- =============================================================
-- Level 1: Direct references to organizations
-- =============================================================

-- ai_chat_jobs.org_id
ALTER TABLE ai_chat_jobs DROP CONSTRAINT ai_chat_jobs_org_id_fkey;
ALTER TABLE ai_chat_jobs ADD CONSTRAINT ai_chat_jobs_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- database_instances.org_id
ALTER TABLE database_instances DROP CONSTRAINT database_instances_org_id_fkey;
ALTER TABLE database_instances ADD CONSTRAINT database_instances_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- error_events.org_id
ALTER TABLE error_events DROP CONSTRAINT error_events_org_id_fkey;
ALTER TABLE error_events ADD CONSTRAINT error_events_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- support_tickets.org_id
ALTER TABLE support_tickets DROP CONSTRAINT support_tickets_org_id_fkey;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- =============================================================
-- Level 2: References to tables that cascade from organizations
-- =============================================================

-- ai_chat_jobs.app_id -> apps (apps cascade from org)
ALTER TABLE ai_chat_jobs DROP CONSTRAINT ai_chat_jobs_app_id_fkey;
ALTER TABLE ai_chat_jobs ADD CONSTRAINT ai_chat_jobs_app_id_fkey
  FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;

-- ai_chat_jobs.session_id -> ai_chat_sessions (sessions cascade from org)
ALTER TABLE ai_chat_jobs DROP CONSTRAINT ai_chat_jobs_session_id_fkey;
ALTER TABLE ai_chat_jobs ADD CONSTRAINT ai_chat_jobs_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE;

-- app_environments.auth_gate_project_id -> projects (SET NULL: don't delete env, just clear ref)
ALTER TABLE app_environments DROP CONSTRAINT app_environments_auth_gate_project_id_fkey;
ALTER TABLE app_environments ADD CONSTRAINT app_environments_auth_gate_project_id_fkey
  FOREIGN KEY (auth_gate_project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- database_migrations.project_id -> projects
ALTER TABLE database_migrations DROP CONSTRAINT database_migrations_project_id_fkey;
ALTER TABLE database_migrations ADD CONSTRAINT database_migrations_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- =============================================================
-- Level 3: References to database_instances (cascades from org)
-- =============================================================

-- database_migrations.from_instance_id -> database_instances
ALTER TABLE database_migrations DROP CONSTRAINT database_migrations_from_instance_id_fkey;
ALTER TABLE database_migrations ADD CONSTRAINT database_migrations_from_instance_id_fkey
  FOREIGN KEY (from_instance_id) REFERENCES database_instances(id) ON DELETE CASCADE;

-- database_migrations.to_instance_id -> database_instances
ALTER TABLE database_migrations DROP CONSTRAINT database_migrations_to_instance_id_fkey;
ALTER TABLE database_migrations ADD CONSTRAINT database_migrations_to_instance_id_fkey
  FOREIGN KEY (to_instance_id) REFERENCES database_instances(id) ON DELETE CASCADE;

-- project_databases.instance_id -> database_instances
ALTER TABLE project_databases DROP CONSTRAINT project_databases_instance_id_fkey;
ALTER TABLE project_databases ADD CONSTRAINT project_databases_instance_id_fkey
  FOREIGN KEY (instance_id) REFERENCES database_instances(id) ON DELETE CASCADE;

-- server_health.instance_id -> database_instances
ALTER TABLE server_health DROP CONSTRAINT server_health_instance_id_fkey;
ALTER TABLE server_health ADD CONSTRAINT server_health_instance_id_fkey
  FOREIGN KEY (instance_id) REFERENCES database_instances(id) ON DELETE CASCADE;

COMMIT;
