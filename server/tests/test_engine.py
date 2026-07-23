"""Task 5.3 — engine core (guards, budgets, approvals, dry-run, recovery)."""

import asyncio
import json

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.config import Settings
from app.db import get_session, init_db
from app.engine.engine import Engine, EnginePaused
from app.engine.mock import MockHermes


def linear_graph():
    return {
        "nodes": [
            {"id": "t", "type": "trigger.manual", "position": {"x": 0, "y": 0}, "config": {}},
            {"id": "h", "type": "hermes.task", "position": {"x": 1, "y": 0},
             "config": {"prompt": "Summarize {{trigger.file_path}}", "timeout_s": 5, "retries": 0}},
            {"id": "f", "type": "file.op", "position": {"x": 2, "y": 0},
             "config": {"op": "write", "path": "out/result.md", "content": "{{h.output_text}}"}},
        ],
        "edges": [
            {"id": "e1", "source": "t", "target": "h", "condition": None},
            {"id": "e2", "source": "h", "target": "f", "condition": None},
        ],
    }


def condition_graph():
    return {
        "nodes": [
            {"id": "t", "type": "trigger.manual", "position": {"x": 0, "y": 0}, "config": {}},
            {"id": "c", "type": "logic.condition", "position": {"x": 1, "y": 0},
             "config": {"expression": "'yes' in trigger.flag"}},
            {"id": "a", "type": "file.op", "position": {"x": 2, "y": 0},
             "config": {"op": "write", "path": "true.md", "content": "T"}},
            {"id": "b", "type": "file.op", "position": {"x": 2, "y": 1},
             "config": {"op": "write", "path": "false.md", "content": "F"}},
        ],
        "edges": [
            {"id": "e1", "source": "t", "target": "c", "condition": None},
            {"id": "e2", "source": "c", "target": "a", "condition": "true"},
            {"id": "e3", "source": "c", "target": "b", "condition": "false"},
        ],
    }


def approval_graph(rejected_branch=True):
    nodes = [
        {"id": "t", "type": "trigger.manual", "position": {"x": 0, "y": 0}, "config": {}},
        {"id": "g", "type": "gate.approval", "position": {"x": 1, "y": 0},
         "config": {"message": "Proceed?", "timeout_h": 24, "notify": []}},
        {"id": "ok", "type": "file.op", "position": {"x": 2, "y": 0},
         "config": {"op": "write", "path": "approved.md", "content": "OK"}},
    ]
    edges = [
        {"id": "e1", "source": "t", "target": "g", "condition": None},
        {"id": "e2", "source": "g", "target": "ok", "condition": "approved"},
    ]
    if rejected_branch:
        nodes.append({"id": "no", "type": "file.op", "position": {"x": 2, "y": 1},
                      "config": {"op": "write", "path": "rejected.md", "content": "NO"}})
        edges.append({"id": "e3", "source": "g", "target": "no", "condition": "rejected"})
    return {"nodes": nodes, "edges": edges}


@pytest_asyncio.fixture
async def env(tmp_path):
    jail = tmp_path / "atlas"
    jail.mkdir()
    settings = Settings(
        data_dir=tmp_path, atlas_root=jail, password="x", secret_key="x",
        mock_hermes=True, dev_mode=True, static_dir=None,
    )
    db_engine = await init_db(tmp_path / "atlas.db")
    try:
        yield settings, jail
    finally:
        await db_engine.dispose()


async def make_workflow(graph, *, max_runs_per_hour=100, budget=None, name="wf"):
    async with get_session() as session:
        result = await session.execute(
            text(
                "INSERT INTO workflows(name, graph, enabled, version, max_runs_per_hour, "
                "budget_usd_per_run, created_at, updated_at) "
                "VALUES (:n, :g, 1, 1, :m, :b, '2026-01-01', '2026-01-01') RETURNING id"
            ),
            {"n": name, "g": json.dumps(graph), "m": max_runs_per_hour, "b": budget},
        )
        wf_id = result.scalar_one()
        await session.commit()
    return wf_id


def make_engine(settings, factory=None):
    return Engine(factory or (lambda: MockHermes()), settings)


async def wait_status(run_id, statuses, timeout=5.0):
    async def _poll():
        while True:
            async with get_session() as session:
                row = (await session.execute(
                    text("SELECT status, error FROM runs WHERE id=:id"), {"id": run_id}
                )).one()
            if row.status in statuses:
                return row
            await asyncio.sleep(0.01)

    return await asyncio.wait_for(_poll(), timeout)


async def get_steps(run_id):
    async with get_session() as session:
        rows = (await session.execute(
            text("SELECT node_id, node_type, status, output, error FROM run_steps "
                 "WHERE run_id=:id ORDER BY id"), {"id": run_id}
        )).all()
    return rows


async def get_run_events(run_id):
    async with get_session() as session:
        rows = (await session.execute(
            text("SELECT kind FROM events WHERE run_id=:id AND kind LIKE 'run.%' ORDER BY id"),
            {"id": run_id},
        )).all()
    return [r.kind for r in rows]


@pytest.mark.asyncio
async def test_linear_graph_succeeds_with_exact_event_sequence(env):
    settings, jail = env
    engine = make_engine(settings)
    wf_id = await make_workflow(linear_graph())
    run_id = await engine.submit(wf_id, "manual", {"file_path": "01_inbox/a.md"})
    row = await wait_status(run_id, {"succeeded", "failed"})
    assert row.status == "succeeded", row.error

    content = (jail / "out" / "result.md").read_text(encoding="utf-8")
    assert "MOCK OUTPUT for: Summarize 01_inbox/a.md" in content  # templating across steps

    steps = await get_steps(run_id)
    assert [s.node_id for s in steps] == ["h", "f"]
    assert all(s.status == "succeeded" for s in steps)

    kinds = await get_run_events(run_id)
    assert kinds == [
        "run.started",
        "run.step_started", "run.step_finished",
        "run.step_started", "run.step_finished",
        "run.finished",
    ]


@pytest.mark.asyncio
async def test_condition_branch_false_path_skipped(env):
    settings, jail = env
    engine = make_engine(settings)
    wf_id = await make_workflow(condition_graph())
    run_id = await engine.submit(wf_id, "manual", {"flag": "yes"})
    row = await wait_status(run_id, {"succeeded", "failed"})
    assert row.status == "succeeded", row.error

    assert (jail / "true.md").exists()
    assert not (jail / "false.md").exists()
    steps = {s.node_id: s.status for s in await get_steps(run_id)}
    assert steps["a"] == "succeeded"
    assert steps["b"] == "skipped"


@pytest.mark.asyncio
async def test_approval_gate_parks_and_resume_approved_completes(env):
    settings, jail = env
    engine = make_engine(settings)
    wf_id = await make_workflow(approval_graph())
    run_id = await engine.submit(wf_id, "manual", {})
    row = await wait_status(run_id, {"waiting_approval"})
    assert row.status == "waiting_approval"

    await engine.resume(run_id, "approved")
    row = await wait_status(run_id, {"succeeded", "failed"})
    assert row.status == "succeeded", row.error
    assert (jail / "approved.md").exists()
    assert not (jail / "rejected.md").exists()
    steps = {s.node_id: s.status for s in await get_steps(run_id)}
    assert steps["no"] == "skipped"


@pytest.mark.asyncio
async def test_resume_rejected_follows_rejected_edge(env):
    settings, jail = env
    engine = make_engine(settings)
    wf_id = await make_workflow(approval_graph(rejected_branch=True))
    run_id = await engine.submit(wf_id, "manual", {})
    await wait_status(run_id, {"waiting_approval"})
    await engine.resume(run_id, "rejected")
    row = await wait_status(run_id, {"succeeded", "failed"})
    assert row.status == "succeeded", row.error
    assert (jail / "rejected.md").exists()
    assert not (jail / "approved.md").exists()


@pytest.mark.asyncio
async def test_resume_rejected_without_rejected_edge_finishes(env):
    settings, jail = env
    engine = make_engine(settings)
    wf_id = await make_workflow(approval_graph(rejected_branch=False))
    run_id = await engine.submit(wf_id, "manual", {})
    await wait_status(run_id, {"waiting_approval"})
    await engine.resume(run_id, "rejected")
    row = await wait_status(run_id, {"succeeded", "failed"})
    assert row.status == "succeeded", row.error
    assert not (jail / "approved.md").exists()


class FailingHermes(MockHermes):
    async def run_events(self, run_id):
        raise RuntimeError("hermes down")
        yield {}


@pytest.mark.asyncio
async def test_failure_marks_run_failed_later_steps_untouched(env):
    settings, jail = env
    engine = make_engine(settings, factory=lambda: FailingHermes())
    wf_id = await make_workflow(linear_graph())
    run_id = await engine.submit(wf_id, "manual", {})
    row = await wait_status(run_id, {"failed"})
    assert row.status == "failed"
    steps = await get_steps(run_id)
    assert [s.node_id for s in steps] == ["h"]  # file.op never reached, no skipped rows
    assert steps[0].status == "failed"
    kinds = await get_run_events(run_id)
    assert kinds[-1] == "run.failed"


@pytest.mark.asyncio
async def test_budget_exceeded_stops_run(env):
    settings, jail = env
    engine = make_engine(settings)
    # MockHermes usage = 150 tokens → cost 0.00015 USD at $1/M > 0.0001 budget
    wf_id = await make_workflow(linear_graph(), budget=0.0001)
    run_id = await engine.submit(wf_id, "manual", {})
    row = await wait_status(run_id, {"budget_exceeded", "succeeded", "failed"})
    assert row.status == "budget_exceeded"
    assert not (jail / "out" / "result.md").exists()


@pytest.mark.asyncio
async def test_circuit_breaker_refuses_third_run(env):
    settings, jail = env
    engine = make_engine(settings)
    wf_id = await make_workflow(linear_graph(), max_runs_per_hour=2)
    r1 = await engine.submit(wf_id, "manual", {})
    r2 = await engine.submit(wf_id, "manual", {})
    r3 = await engine.submit(wf_id, "manual", {})
    await wait_status(r1, {"succeeded"})
    await wait_status(r2, {"succeeded"})
    row = await wait_status(r3, {"failed"})
    assert row.error == "circuit breaker"


@pytest.mark.asyncio
async def test_kill_switch_raises_engine_paused(env):
    settings, jail = env
    engine = make_engine(settings)
    wf_id = await make_workflow(linear_graph())
    async with get_session() as session:
        await session.execute(
            text("INSERT OR REPLACE INTO settings(key, value) VALUES ('global_pause', '1')")
        )
        await session.commit()
    with pytest.raises(EnginePaused):
        await engine.submit(wf_id, "manual", {})


@pytest.mark.asyncio
async def test_queue_of_one_per_workflow(env):
    settings, jail = env
    engine = make_engine(settings)
    wf_id = await make_workflow(linear_graph())
    r1 = await engine.submit(wf_id, "manual", {})
    r2 = await engine.submit(wf_id, "manual", {})
    await wait_status(r1, {"succeeded"})
    await wait_status(r2, {"succeeded"})
    async with get_session() as session:
        rows = (await session.execute(
            text("SELECT run_id, MIN(started_at) s, MAX(finished_at) f FROM run_steps "
                 "WHERE run_id IN (:a, :b) GROUP BY run_id ORDER BY run_id"),
            {"a": r1, "b": r2},
        )).all()
    # the per-workflow lock serializes the runs (in either acquisition order):
    # one run's steps must all finish before the other's first step starts
    assert rows[1].s >= rows[0].f or rows[0].s >= rows[1].f


@pytest.mark.asyncio
async def test_restart_recovery(env):
    settings, jail = env
    wf_id = await make_workflow(linear_graph())
    async with get_session() as session:
        result = await session.execute(
            text("INSERT INTO runs(workflow_id, status, trigger_kind, created_at) "
                 "VALUES (:wf, 'running', 'manual', '2026-01-01') RETURNING id"),
            {"wf": wf_id},
        )
        stuck_id = result.scalar_one()
        result = await session.execute(
            text("INSERT INTO runs(workflow_id, status, trigger_kind, created_at) "
                 "VALUES (:wf, 'waiting_approval', 'manual', '2026-01-01') RETURNING id"),
            {"wf": wf_id},
        )
        parked_id = result.scalar_one()
        await session.commit()

    engine = make_engine(settings)
    await engine.startup()

    async with get_session() as session:
        stuck = (await session.execute(
            text("SELECT status, error FROM runs WHERE id=:id"), {"id": stuck_id}
        )).one()
        parked = (await session.execute(
            text("SELECT status FROM runs WHERE id=:id"), {"id": parked_id}
        )).one()
    assert stuck.status == "failed"
    assert stuck.error == "interrupted by restart"
    assert parked.status == "waiting_approval"  # still pending, resumable


@pytest.mark.asyncio
async def test_dry_run_uses_mock_and_shadow_dir(env):
    settings, jail = env
    calls = []

    def spy_factory():
        calls.append(1)
        return MockHermes()

    engine = make_engine(settings, factory=spy_factory)
    wf_id = await make_workflow(linear_graph())
    run_id = await engine.submit(wf_id, "manual", {}, dry_run=True)
    row = await wait_status(run_id, {"succeeded", "failed"})
    assert row.status == "succeeded", row.error
    assert calls == []  # real factory never called
    assert not (jail / "out" / "result.md").exists()
    shadow = settings.data_dir / "dryrun" / "out" / "result.md"
    assert shadow.exists()


@pytest.mark.asyncio
async def test_run_failed_status_never_visible_before_its_event_is_recorded(env, monkeypatch):
    """Root cause of the F2 flake in
    test_failure_marks_run_failed_later_steps_untouched (intermittently
    observing kinds[-1] == 'run.step_finished' instead of 'run.failed'):

    Engine._fail_run() updates runs.status to 'failed' in one commit and
    THEN appends the 'run.failed' event in a separate, later commit. Between
    those two commits there is a real window -- reachable under ordinary
    asyncio scheduling, not a test artifact -- during which an external
    reader can observe status == 'failed' while the run.failed event does
    not exist yet. That is exactly what get_run_events() sometimes caught:
    wait_status() returns the instant status flips to 'failed', and if the
    scheduler happens to run the poller in the gap before append_event's
    own commit lands, the event query comes back one event short.

    This test proves the window deterministically instead of relying on
    suite-timing luck: it freezes execution at the exact instant engine.py
    is about to persist the run.failed event (via a monkeypatched
    app.engine.engine.append_event) and inspects DB state at that instant.
    """
    import app.engine.engine as engine_mod

    settings, jail = env
    engine = make_engine(settings, factory=lambda: FailingHermes())
    wf_id = await make_workflow(linear_graph())

    entered = asyncio.Event()
    release = asyncio.Event()
    real_append_event = engine_mod.append_event

    async def spy_append_event(kind, *args, **kwargs):
        if kind == "run.failed":
            entered.set()
            await release.wait()
        return await real_append_event(kind, *args, **kwargs)

    monkeypatch.setattr(engine_mod, "append_event", spy_append_event)

    run_id = await engine.submit(wf_id, "manual", {})
    await asyncio.wait_for(entered.wait(), timeout=5.0)

    # Frozen exactly before the run.failed event write executes.
    async with get_session() as session:
        status = (
            await session.execute(
                text("SELECT status FROM runs WHERE id=:id"), {"id": run_id}
            )
        ).scalar_one()
        event_exists = (
            await session.execute(
                text("SELECT 1 FROM events WHERE run_id=:id AND kind='run.failed'"),
                {"id": run_id},
            )
        ).one_or_none() is not None

    release.set()
    await wait_status(run_id, {"failed"})

    # The invariant a status-poller relies on: status can only ever be
    # observed as 'failed' once the event backing it has already been
    # durably recorded.
    assert not (status == "failed" and not event_exists), (
        f"status={status!r} was already 'failed' while the run.failed event "
        f"did not exist yet (event_exists={event_exists}) -- status became "
        "externally visible before its event was recorded"
    )
