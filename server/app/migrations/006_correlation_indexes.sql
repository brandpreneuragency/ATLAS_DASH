-- 006_correlation_indexes.sql — correlation_id index for traceability
-- Up: lightweight index on events(correlation_id) for cross-entity tracing.
-- This is the most common correlation query path: find all events for a given token.

CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events(correlation_id);

-- DOWN:
-- DROP INDEX IF EXISTS idx_events_correlation_id;
