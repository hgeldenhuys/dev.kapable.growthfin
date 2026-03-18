-- Migration 050: Per-org Incus bridge networks for container isolation

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bridge_name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bridge_subnet TEXT;

-- Comments
COMMENT ON COLUMN organizations.bridge_name IS 'Incus bridge device name, e.g. sdb-br-acme — populated at first container-mode deploy';
COMMENT ON COLUMN organizations.bridge_subnet IS 'IPv4 subnet allocated from pool, e.g. 10.34.1.0/26';
