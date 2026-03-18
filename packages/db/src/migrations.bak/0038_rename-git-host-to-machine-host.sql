-- Rename git_host column to machine_host
ALTER TABLE projects RENAME COLUMN git_host TO machine_host;

-- Update comment
COMMENT ON COLUMN projects.machine_host IS 'Machine hostname where the project is being worked on (e.g., "mbp-studio")';
