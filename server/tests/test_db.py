import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db import get_session, init_db


@pytest.mark.asyncio
async def test_migrations_apply_and_wal(tmp_path):
    engine = await init_db(tmp_path / "test.db")
    async with get_session() as s:
        tables = (
            await s.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            )
        ).scalars().all()
        assert {"settings", "agents", "events", "schema_migrations"} <= set(tables)
        mode = (await s.execute(text("PRAGMA journal_mode"))).scalar()
        assert mode == "wal"
    await engine.dispose()


@pytest.mark.asyncio
async def test_run_status_triggers_reject_invalid_accept_ratified_values(tmp_path):
    """005_run_status_check.sql (D-M4-STATUS-VOCAB / D-M4-STATUS-ENFORCE):
    BEFORE INSERT / BEFORE UPDATE OF status triggers on `runs` must accept
    only the seven ratified values and RAISE(ABORT) on anything else, for
    both INSERT and UPDATE. This also exercises the migration runner's
    ability to apply a migration file containing compound CREATE TRIGGER
    statements whose bodies contain semicolons (see app/db.py's
    executescript-based statement handling).
    """
    engine = await init_db(tmp_path / "test.db")

    async with get_session() as s:
        trigger_names = (
            await s.execute(
                text("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")
            )
        ).scalars().all()
        assert trigger_names == [
            "trg_runs_status_insert_check",
            "trg_runs_status_update_check",
        ]

        workflow_id = (
            await s.execute(
                text(
                    "INSERT INTO workflows(name, graph, enabled, version, "
                    "max_runs_per_hour, created_at, updated_at) VALUES "
                    "('wf', '{}', 1, 1, 100, '2026-01-01', '2026-01-01') "
                    "RETURNING id"
                )
            )
        ).scalar_one()
        await s.commit()

    # A ratified status is accepted on INSERT.
    async with get_session() as s:
        run_id = (
            await s.execute(
                text(
                    "INSERT INTO runs(workflow_id, status, trigger_kind, created_at) "
                    "VALUES (:wf, 'queued', 'manual', '2026-01-01') RETURNING id"
                ),
                {"wf": workflow_id},
            )
        ).scalar_one()
        await s.commit()

    # A ratified status is accepted on UPDATE.
    async with get_session() as s:
        await s.execute(
            text("UPDATE runs SET status='running' WHERE id=:id"), {"id": run_id}
        )
        await s.commit()

    async with get_session() as s:
        status = (
            await s.execute(text("SELECT status FROM runs WHERE id=:id"), {"id": run_id})
        ).scalar_one()
        assert status == "running"

    # An unratified status is rejected on INSERT.
    with pytest.raises(IntegrityError):
        async with get_session() as s:
            await s.execute(
                text(
                    "INSERT INTO runs(workflow_id, status, trigger_kind, created_at) "
                    "VALUES (:wf, 'bogus', 'manual', '2026-01-01')"
                ),
                {"wf": workflow_id},
            )
            await s.commit()

    # An unratified status is rejected on UPDATE, and the row is left untouched.
    with pytest.raises(IntegrityError):
        async with get_session() as s:
            await s.execute(
                text("UPDATE runs SET status='bogus' WHERE id=:id"), {"id": run_id}
            )
            await s.commit()

    async with get_session() as s:
        status = (
            await s.execute(text("SELECT status FROM runs WHERE id=:id"), {"id": run_id})
        ).scalar_one()
        assert status == "running"  # unchanged by the rejected update

    await engine.dispose()
