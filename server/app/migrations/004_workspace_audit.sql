-- 004_workspace_audit.sql — workspace_id, revision, updated_at, updated_by, correlation_id
-- Up: additive column additions (all reversible via DROP COLUMN)
--
-- NOTE: SQLite does NOT support non-constant DEFAULT expressions in
-- ALTER TABLE ADD COLUMN, so updated_at is added as nullable TEXT and
-- existing rows are backfilled.  Fresh rows use application-layer defaults.

ALTER TABLE settings ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE settings ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN updated_at TEXT;
ALTER TABLE settings ADD COLUMN updated_by TEXT;

ALTER TABLE agents ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE agents ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agents ADD COLUMN updated_at TEXT;
ALTER TABLE agents ADD COLUMN updated_by TEXT;
ALTER TABLE agents ADD COLUMN correlation_id TEXT;

ALTER TABLE events ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE events ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE events ADD COLUMN updated_at TEXT;
ALTER TABLE events ADD COLUMN updated_by TEXT;
ALTER TABLE events ADD COLUMN correlation_id TEXT;

ALTER TABLE chat_threads ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE chat_threads ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE chat_threads ADD COLUMN updated_at TEXT;
ALTER TABLE chat_threads ADD COLUMN updated_by TEXT;
ALTER TABLE chat_threads ADD COLUMN correlation_id TEXT;

ALTER TABLE workflows ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE workflows ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workflows ADD COLUMN updated_by TEXT;
-- NOTE: workflows.updated_at already exists (from 003_workflows.sql).

ALTER TABLE workflow_versions ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE workflow_versions ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workflow_versions ADD COLUMN updated_at TEXT;
ALTER TABLE workflow_versions ADD COLUMN updated_by TEXT;

ALTER TABLE runs ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE runs ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE runs ADD COLUMN updated_at TEXT;
ALTER TABLE runs ADD COLUMN updated_by TEXT;
ALTER TABLE runs ADD COLUMN correlation_id TEXT;

ALTER TABLE run_steps ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE run_steps ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE run_steps ADD COLUMN updated_at TEXT;
ALTER TABLE run_steps ADD COLUMN updated_by TEXT;
ALTER TABLE run_steps ADD COLUMN correlation_id TEXT;

ALTER TABLE approvals ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE approvals ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE approvals ADD COLUMN updated_at TEXT;
ALTER TABLE approvals ADD COLUMN updated_by TEXT;
ALTER TABLE approvals ADD COLUMN correlation_id TEXT;

-- Backfill updated_at for existing rows.
UPDATE settings SET updated_at = datetime('now') WHERE updated_at IS NULL;
UPDATE agents SET updated_at = datetime('now') WHERE updated_at IS NULL;
UPDATE events SET updated_at = datetime('now') WHERE updated_at IS NULL;
UPDATE chat_threads SET updated_at = datetime('now') WHERE updated_at IS NULL;
UPDATE workflow_versions SET updated_at = datetime('now') WHERE updated_at IS NULL;
UPDATE runs SET updated_at = datetime('now') WHERE updated_at IS NULL;
UPDATE run_steps SET updated_at = datetime('now') WHERE updated_at IS NULL;
UPDATE approvals SET updated_at = datetime('now') WHERE updated_at IS NULL;

-- DOWN (reversible via DROP COLUMN, SQLite >= 3.35.0):
--
-- ROLLBACK ORDER WARNING (M4-05): 006_correlation_indexes.sql creates
-- idx_events_correlation_id on events(correlation_id), a column this
-- migration (004) adds. If 004's DOWN below is applied before 006's DOWN
-- (DROP INDEX idx_events_correlation_id), dropping events.correlation_id
-- fails: "error in index idx_events_correlation_id after drop column: no
-- such column: correlation_id" (confirmed against both a synthetic db and
-- a copy of the live-DB snapshot — see migration-test.log). Roll back in
-- REVERSE migration order: 006 DOWN, THEN 005 DOWN (no-op), THEN 004 DOWN.
--
-- ALTER TABLE settings DROP COLUMN workspace_id;
-- ALTER TABLE settings DROP COLUMN revision;
-- ALTER TABLE settings DROP COLUMN updated_at;
-- ALTER TABLE settings DROP COLUMN updated_by;
-- ALTER TABLE agents DROP COLUMN workspace_id;
-- ALTER TABLE agents DROP COLUMN revision;
-- ALTER TABLE agents DROP COLUMN updated_at;
-- ALTER TABLE agents DROP COLUMN updated_by;
-- ALTER TABLE agents DROP COLUMN correlation_id;
-- ALTER TABLE events DROP COLUMN workspace_id;
-- ALTER TABLE events DROP COLUMN revision;
-- ALTER TABLE events DROP COLUMN updated_at;
-- ALTER TABLE events DROP COLUMN updated_by;
-- ALTER TABLE events DROP COLUMN correlation_id;
-- ALTER TABLE chat_threads DROP COLUMN workspace_id;
-- ALTER TABLE chat_threads DROP COLUMN revision;
-- ALTER TABLE chat_threads DROP COLUMN updated_at;
-- ALTER TABLE chat_threads DROP COLUMN updated_by;
-- ALTER TABLE chat_threads DROP COLUMN correlation_id;
-- ALTER TABLE workflows DROP COLUMN workspace_id;
-- ALTER TABLE workflows DROP COLUMN revision;
-- ALTER TABLE workflows DROP COLUMN updated_by;
-- ALTER TABLE workflow_versions DROP COLUMN workspace_id;
-- ALTER TABLE workflow_versions DROP COLUMN revision;
-- ALTER TABLE workflow_versions DROP COLUMN updated_at;
-- ALTER TABLE workflow_versions DROP COLUMN updated_by;
-- ALTER TABLE runs DROP COLUMN workspace_id;
-- ALTER TABLE runs DROP COLUMN revision;
-- ALTER TABLE runs DROP COLUMN updated_at;
-- ALTER TABLE runs DROP COLUMN updated_by;
-- ALTER TABLE runs DROP COLUMN correlation_id;
-- ALTER TABLE run_steps DROP COLUMN workspace_id;
-- ALTER TABLE run_steps DROP COLUMN revision;
-- ALTER TABLE run_steps DROP COLUMN updated_at;
-- ALTER TABLE run_steps DROP COLUMN updated_by;
-- ALTER TABLE run_steps DROP COLUMN correlation_id;
-- ALTER TABLE approvals DROP COLUMN workspace_id;
-- ALTER TABLE approvals DROP COLUMN revision;
-- ALTER TABLE approvals DROP COLUMN updated_at;
-- ALTER TABLE approvals DROP COLUMN updated_by;
-- ALTER TABLE approvals DROP COLUMN correlation_id;
