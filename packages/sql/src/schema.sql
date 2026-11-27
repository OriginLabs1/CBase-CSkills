-- OneOrigin v0.0.2 PostgreSQL schema. Both OneOrigin-operated and
-- independently operated deployments use this exact schema and adapter.
CREATE TABLE IF NOT EXISTS oneorigin_records (
  namespace   text NOT NULL,
  key         text NOT NULL,
  value       bytea NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace, key)
);

CREATE TABLE IF NOT EXISTS oneorigin_events (
  seq      bigint PRIMARY KEY,
  event    jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- The journal is append-only: no UPDATE or DELETE grants for application roles.
CREATE INDEX IF NOT EXISTS oneorigin_events_namespace_key
  ON oneorigin_events (((event->>'namespace')), ((event->>'key')));

-- Optional extension for deployments using row-level security:
-- ALTER TABLE oneorigin_records ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE oneorigin_events ENABLE ROW LEVEL SECURITY;
