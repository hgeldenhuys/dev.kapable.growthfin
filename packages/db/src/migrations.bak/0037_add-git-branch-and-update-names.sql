-- Add git_branch column to projects table
ALTER TABLE projects ADD COLUMN git_branch text;

-- Update existing project names to use git_repo if available
UPDATE projects
SET name = git_repo
WHERE git_repo IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN projects.git_branch IS 'Current git branch (e.g., main, feature/xyz)';
