-- System Guardian: structured event log for operational monitoring
-- Run in Supabase SQL editor or via supabase db push

DO $$ BEGIN
  CREATE TYPE system_event_severity AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS system_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  severity     system_event_severity NOT NULL DEFAULT 'info',
  source       text        NOT NULL,
  event_type   text        NOT NULL,
  message      text        NOT NULL,
  user_id      uuid        REFERENCES auth.users(id)  ON DELETE SET NULL,
  package_id   uuid,
  trip_id      uuid        REFERENCES trips(id)        ON DELETE SET NULL,
  order_id     uuid        REFERENCES orders(id)       ON DELETE SET NULL,
  request_id   text,
  metadata     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_events_severity    ON system_events(severity);
CREATE INDEX IF NOT EXISTS idx_system_events_source      ON system_events(source);
CREATE INDEX IF NOT EXISTS idx_system_events_event_type  ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at  ON system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_unresolved  ON system_events(created_at DESC) WHERE resolved_at IS NULL;

-- RLS: only service role writes; admin reads handled server-side via service client
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- No public policies — all reads/writes go through server-side service client
-- Admins access via /api/guardian/* routes which verify role server-side
