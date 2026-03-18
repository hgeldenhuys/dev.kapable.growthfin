-- Add git fields to projects table
ALTER TABLE projects
ADD COLUMN git_repo text,
ADD COLUMN git_host text,
ADD COLUMN git_user text;

-- Add comments for documentation
COMMENT ON COLUMN projects.git_repo IS 'Repository name (e.g., agios)';
COMMENT ON COLUMN projects.git_host IS 'Git hostname (e.g., github.com)';
COMMENT ON COLUMN projects.git_user IS 'Git username (e.g., hgeldenhuys)';