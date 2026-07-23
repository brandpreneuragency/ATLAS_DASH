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


@pytest.mark.asyncio
async def test_broken_migration_leaves_no_trace_earlier_migrations_intact(
    tmp_path, monkeypatch
):
    """The migration runner must apply each migration's DDL and record its
    ``schema_migrations`` version row as ONE atomic unit (see app/db.py).

    We point ``_migration_dir()`` at a synthetic set of three migrations: a
    good one, a deliberately broken one in the middle (creates a real table
    then hits invalid SQL), and a good one after it. ``init_db`` must raise,
    and afterward -- inspected via a completely fresh connection, bypassing
    this module's global session state -- the broken migration must have
    left NO trace at all: neither its schema object (``broken_marker``) nor
    its ``schema_migrations`` version row may exist. The earlier migration
    must remain both applied (its table exists) and recorded (its version
    row exists); the later migration must never have been attempted.
    """
    import aiosqlite

    import app.db as db_mod

    fake_dir = tmp_path / "migrations"
    fake_dir.mkdir()
    (fake_dir / "001_good.sql").write_text(
        "CREATE TABLE t1 (id INTEGER PRIMARY KEY);\n", encoding="utf-8"
    )
    (fake_dir / "002_broken.sql").write_text(
        "CREATE TABLE broken_marker (id INTEGER PRIMARY KEY);\n"
        "THIS IS NOT VALID SQL AT ALL;\n",
        encoding="utf-8",
    )
    (fake_dir / "003_good.sql").write_text(
        "CREATE TABLE t3 (id INTEGER PRIMARY KEY);\n", encoding="utf-8"
    )

    monkeypatch.setattr(db_mod, "_migration_dir", lambda: fake_dir)

    db_path = tmp_path / "atomicity_test.db"
    with pytest.raises(Exception):
        await db_mod.init_db(db_path)

    # Inspect on-disk state via a brand new, independent connection.
    conn = await aiosqlite.connect(str(db_path))
    try:
        cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in await cursor.fetchall()}
        cursor = await conn.execute("SELECT version FROM schema_migrations")
        versions = {row[0] for row in await cursor.fetchall()}
    finally:
        await conn.close()

    # Earlier migration: applied AND recorded.
    assert "t1" in tables
    assert 1 in versions

    # Broken migration: NO trace at all -- neither its table nor its version row.
    assert "broken_marker" not in tables
    assert 2 not in versions

    # Later migration: never reached (the loop aborts on the first failure).
    assert "t3" not in tables
    assert 3 not in versions
