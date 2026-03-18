-- Add todos persistence across sessions
-- Creates a separate todos table for persistent todo management

-- Create todos table for persistent storage
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session reference (for history)
  session_id TEXT NOT NULL REFERENCES claude_sessions(id) ON DELETE CASCADE,

  -- Project and agent scoping (for persistence)
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL, -- Agent type identifier (e.g., 'main', 'backend-dev', etc.)

  -- Todo content
  content TEXT NOT NULL,
  active_form TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
  "order" INTEGER NOT NULL DEFAULT 0,

  -- Persistence flags
  is_latest BOOLEAN NOT NULL DEFAULT true, -- Marks current working set
  migrated_from TEXT, -- Source session if migrated

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX idx_todos_project_agent_latest
  ON todos(project_id, agent_id, is_latest)
  WHERE is_latest = true;

CREATE INDEX idx_todos_session_id ON todos(session_id);
CREATE INDEX idx_todos_created_at ON todos(created_at);

-- Comment on table
COMMENT ON TABLE todos IS 'Persistent todos that survive across sessions';
COMMENT ON COLUMN todos.is_latest IS 'Marks todos as part of the current working set';
COMMENT ON COLUMN todos.migrated_from IS 'Source session ID if todo was migrated from previous session';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_todos_updated_at();

-- Migrate existing todos from claude_sessions JSONB to new table
DO $$
DECLARE
  session_record RECORD;
  todo_item JSONB;
  todo_order INTEGER;
BEGIN
  -- Loop through all sessions with todos
  FOR session_record IN
    SELECT id, project_id, current_agent_type, todos
    FROM claude_sessions
    WHERE todos IS NOT NULL
  LOOP
    todo_order := 0;

    -- Loop through each todo in the JSONB array
    FOR todo_item IN SELECT * FROM jsonb_array_elements(session_record.todos)
    LOOP
      -- Insert each todo into the new table
      INSERT INTO todos (
        session_id,
        project_id,
        agent_id,
        content,
        active_form,
        status,
        "order",
        is_latest,
        created_at
      ) VALUES (
        session_record.id,
        session_record.project_id,
        COALESCE(session_record.current_agent_type, 'main'),
        todo_item->>'content',
        todo_item->>'activeForm',
        todo_item->>'status',
        todo_order,
        false, -- Mark as historical (not latest) initially
        CURRENT_TIMESTAMP
      );

      todo_order := todo_order + 1;
    END LOOP;
  END LOOP;

  -- Mark todos from the most recent session per project/agent as latest
  UPDATE todos t1
  SET is_latest = true
  WHERE (t1.project_id, t1.agent_id, t1.created_at) IN (
    SELECT t2.project_id, t2.agent_id, MAX(t2.created_at)
    FROM todos t2
    GROUP BY t2.project_id, t2.agent_id
  );
END $$;

-- Add notification for todo changes (for real-time updates)
CREATE OR REPLACE FUNCTION notify_todo_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'todo_change',
    json_build_object(
      'operation', TG_OP,
      'project_id', NEW.project_id,
      'agent_id', NEW.agent_id,
      'todo_id', NEW.id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER todos_notify
  AFTER INSERT OR UPDATE OR DELETE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION notify_todo_change();