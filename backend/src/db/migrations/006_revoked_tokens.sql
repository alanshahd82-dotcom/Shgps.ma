-- 006_revoked_tokens.sql — Durable JWT revocation store (security hardening).
-- Revoked access tokens are persisted here so a backend restart no longer
-- resurrects logged-out/admin-revoked sessions. Only sha256 token hashes are
-- stored, never raw tokens. Rows are pruned by expires_at.
CREATE TABLE IF NOT EXISTS revoked_tokens (
  id         SERIAL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);
DELETE FROM revoked_tokens WHERE expires_at < NOW() - INTERVAL '7 days';
