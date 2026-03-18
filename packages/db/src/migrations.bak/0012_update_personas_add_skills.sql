-- Update personas table with new fields for roles and skills
-- Drop existing personas table (no data loss concern in early dev)
DROP TABLE IF EXISTS personas CASCADE;

-- Create updated personas table
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  role TEXT NOT NULL,  -- Flexible - no CHECK constraint, allows any role
  color TEXT NOT NULL,
  voice TEXT,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, slug)
);

-- Create indexes for personas
CREATE INDEX personas_project_id_idx ON personas(project_id);
CREATE INDEX personas_project_default_idx ON personas(project_id, is_default);
CREATE INDEX personas_project_slug_idx ON personas(project_id, slug);

-- Create persona_skills junction table
CREATE TABLE persona_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(persona_id, skill_name)
);

-- Create indexes for persona_skills
CREATE INDEX persona_skills_persona_id_idx ON persona_skills(persona_id);
CREATE INDEX persona_skills_priority_idx ON persona_skills(persona_id, priority);

-- Add persona references to related tables
ALTER TABLE projects
  ADD COLUMN default_persona_id UUID REFERENCES personas(id);

ALTER TABLE claude_sessions
  ADD COLUMN current_persona_id UUID REFERENCES personas(id);

ALTER TABLE event_summaries
  ADD COLUMN persona_id UUID REFERENCES personas(id);

-- Create indexes for foreign keys
CREATE INDEX projects_default_persona_idx ON projects(default_persona_id);
CREATE INDEX claude_sessions_persona_idx ON claude_sessions(current_persona_id);
CREATE INDEX event_summaries_persona_idx ON event_summaries(persona_id);
