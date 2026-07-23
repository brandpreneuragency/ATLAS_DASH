from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _migration_dir() -> Path:
    return Path(__file__).parent / "migrations"


async def init_db(path: str | Path) -> AsyncEngine:
    global _engine, _sessionmaker

    db_path = Path(path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migrations "
                "(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        applied = set(
            (
                await conn.execute(text("SELECT version FROM schema_migrations"))
            ).scalars().all()
        )
        for migration in sorted(_migration_dir().glob("*.sql")):
            version = int(migration.name.split("_", 1)[0])
            if version in applied:
                continue
            # NOTE: migration files may contain compound statements whose
            # bodies themselves contain semicolons (e.g. CREATE TRIGGER ...
            # BEGIN ... ; ... ; END;). A naive `.split(";")` would shred
            # those bodies into invalid fragments. Instead, hand the whole
            # file to the underlying DBAPI connection's executescript(),
            # which uses SQLite's real SQL parser/tokenizer and correctly
            # treats a trigger's BEGIN...END block as a single statement
            # regardless of internal semicolons.
            #
            # ATOMICITY: executescript() implicitly COMMITs any pending
            # transaction before it runs, *unless* the script itself
            # already contains transaction-control statements (BEGIN /
            # COMMIT / ROLLBACK / SAVEPOINT / RELEASE). Without those, the
            # migration's DDL and its `INSERT INTO schema_migrations` row
            # land in two separately-committed transactions: if the process
            # dies between them, the migration is applied but unrecorded,
            # and every subsequent startup re-applies it and dies on
            # (e.g.) a duplicate column -- permanently. To make the
            # migration and its version row one atomic unit, we wrap the
            # whole thing in an explicit BEGIN/COMMIT *inside* the script
            # text handed to executescript(); that in-script BEGIN is what
            # suppresses the implicit pre-commit.
            #
            # On failure we roll back via the DBAPI connection's own
            # rollback() -- NOT via a second `executescript("ROLLBACK;")`
            # call. A ROLLBACK-only script contains no BEGIN, so it
            # re-triggers that same "commit any pending transaction first"
            # behaviour in the sqlite3 module and silently COMMITs the very
            # transaction we're trying to roll back, leaking the failed
            # migration's partial DDL onto disk (verified empirically
            # against this exact aiosqlite/SQLAlchemy driver stack: a
            # ROLLBACK sent through executescript() left a partially
            # created table on disk with no matching schema_migrations
            # row; a plain rollback() correctly discarded it).
            migration_sql = migration.read_text(encoding="utf-8")
            script = (
                "BEGIN;\n"
                + migration_sql
                + f"\nINSERT INTO schema_migrations(version) VALUES ({version});\n"
                + "COMMIT;\n"
            )
            raw_connection = await conn.get_raw_connection()
            driver_connection = raw_connection.driver_connection
            assert driver_connection is not None
            try:
                await driver_connection.executescript(script)
            except Exception:
                try:
                    await driver_connection.rollback()
                except Exception:
                    pass  # nothing to roll back (failure occurred before BEGIN took effect)
                raise

    _engine = engine
    _sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    return engine


@asynccontextmanager
async def get_session() -> AsyncIterator[AsyncSession]:
    if _sessionmaker is None:
        raise RuntimeError("Database has not been initialized")
    async with _sessionmaker() as session:
        yield session
