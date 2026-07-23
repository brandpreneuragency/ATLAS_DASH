-- 005_run_status_check.sql — enforce the ratified runs.status vocabulary via triggers
--
-- RATIFIED AT CP-M4 (owner, 2026-07-23) — D-M4-STATUS-VOCAB / D-M4-STATUS-ENFORCE.
-- Supersedes phase 2's documentation-only placeholder ("SELECT 1 WHERE 1=0"),
-- which was reported as finding M4-04. See SPEC.md "Amended at CP-M4" for the
-- full rationale text and CP_M4_RUNBOOK.md's "Decisions taken at CP-M4" section.
--
-- D-M4-STATUS-VOCAB ratified the code's actual runtime vocabulary (grep of
-- every literal `runs.status = ...` write in app/engine/engine.py) as the
-- formalized state machine, instead of renaming live data to match SPEC R2's
-- original prose list (which named two states, 'starting' and 'paused', that
-- the engine has never written, and misspelled two more). The seven ratified
-- values are exactly:
--
--   queued            -- default (003_workflows.sql)
--   running           -- engine.py
--   waiting_approval  -- engine.py (NOT 'waiting_for_approval')
--   succeeded         -- engine.py (NOT 'completed')
--   failed            -- engine.py
--   cancelled         -- engine.py
--   budget_exceeded   -- engine.py
--
-- D-M4-STATUS-ENFORCE ratified enforcing this vocabulary in the database with
-- TRIGGERs rather than a CHECK constraint. Why triggers and not CHECK:
-- SQLite has no `ALTER TABLE ... ADD CONSTRAINT` in any version, so a real
-- CHECK constraint on an existing table can only be added via the SQLite
-- 12-step create-copy-drop-rename table-rebuild. That rebuild is not cleanly
-- reversible (there is no `ALTER TABLE ... DROP CONSTRAINT` to undo it short
-- of rebuilding the table again) and it disturbs the FK-referencing children
-- `run_steps` and `approvals`, which point at `runs.id` and would need their
-- foreign keys re-pointed at the rebuilt table. Triggers deliver real
-- database-level enforcement while remaining purely additive: they touch no
-- existing row, no existing column, and no other table.
--
-- Verified 2026-07-23 against a copy of $RUN_DIR/live-snapshot.db: a valid
-- status UPDATE was accepted, an invalid one was rejected with RAISE(ABORT),
-- and after DROP TRIGGER the invalid write was accepted again, confirming
-- clean reversibility. PRAGMA integrity_check stayed "ok" throughout. See
-- migration-test.log for the transcript.
--
-- Up: two BEFORE triggers that abort any INSERT or status UPDATE carrying a
-- value outside the seven ratified strings above.

CREATE TRIGGER IF NOT EXISTS trg_runs_status_insert_check
BEFORE INSERT ON runs
WHEN NEW.status NOT IN ('queued', 'running', 'waiting_approval', 'succeeded', 'failed', 'cancelled', 'budget_exceeded')
BEGIN
  SELECT RAISE(ABORT, 'invalid runs.status - must be one of queued, running, waiting_approval, succeeded, failed, cancelled, budget_exceeded');
END;

CREATE TRIGGER IF NOT EXISTS trg_runs_status_update_check
BEFORE UPDATE OF status ON runs
WHEN NEW.status NOT IN ('queued', 'running', 'waiting_approval', 'succeeded', 'failed', 'cancelled', 'budget_exceeded')
BEGIN
  SELECT RAISE(ABORT, 'invalid runs.status - must be one of queued, running, waiting_approval, succeeded, failed, cancelled, budget_exceeded');
END;

-- DOWN (cleanly reversible, purely additive Up means Down is a plain drop):
--
-- DROP TRIGGER trg_runs_status_insert_check;
-- DROP TRIGGER trg_runs_status_update_check;
--
-- Rollback ordering: these triggers depend only on the `runs` table itself
-- (created in 003_workflows.sql), not on any column added by 004 or any
-- index added by 006, so dropping them has no ordering interaction with
-- 004's or 006's DOWN paths. They may be dropped independently, at any
-- point in the rollback sequence, before or after 004/006 DOWN.
