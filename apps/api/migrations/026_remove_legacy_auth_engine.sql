-- Migration 026: Remove legacy auth engine, make BetterAuth the only engine
-- All projects now use BetterAuth exclusively.
-- Column retained for audit trail.

UPDATE auth_configs SET auth_engine = 'betterauth' WHERE auth_engine = 'legacy' OR auth_engine IS NULL;
ALTER TABLE auth_configs ALTER COLUMN auth_engine SET DEFAULT 'betterauth';
