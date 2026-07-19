-- Guardian login-security lookup indexes.
-- No raw email addresses or IP addresses are stored; only keyed fingerprints.

CREATE INDEX IF NOT EXISTS idx_system_events_login_identifier
  ON system_events ((metadata->>'identifier_fingerprint'), created_at DESC)
  WHERE event_type = 'login_failed' AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_events_login_source
  ON system_events ((metadata->>'source_fingerprint'), created_at DESC)
  WHERE event_type = 'login_failed' AND resolved_at IS NULL;
