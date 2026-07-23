"""Approvals routes (MASTER_PLAN §5) — resolving a gate resumes its run.

Atomic claim boundary (SPEC R3 / D-APPROVALS): every approval resolution
starts with an atomic ``UPDATE ... WHERE id=:id AND status='pending' RETURNING``
so that the first caller wins, whether it is a ``gate`` approval or a
``hermes_run`` approval. A concurrent call finds zero rows claimed and
receives HTTP 409.

Failure-after-claim behaviour (M4-01/M4-02, documented deliberately):

* ``hermes_run`` — the claim commits first, then Hermes is called. If the
  Hermes call itself fails (network error, Hermes-side rejection, etc.) the
  claim is released back to ``pending`` (status/resolved_at/resolved_via
  reset) and the caller gets HTTP 502, so the approval remains resolvable
  and no decision is silently lost. If Hermes accepts the decision, the
  local row already reflects the resolved status.
* ``gate`` — the claim commits first, then ``engine.resume()`` performs its
  own atomic ``runs`` claim (``waiting_approval`` -> ``running``). If that
  second claim fails (``ValueError`` — the run is not sitting in
  ``waiting_approval`` at that instant), the approvals claim taken above is
  released back to ``pending`` and the caller gets HTTP 409, rather than an
  unhandled exception with a permanently consumed approval and a
  permanently stuck run.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text

from app.auth import require_session
from app.db import get_session
from app.events import append_event

router = APIRouter(prefix="/api", dependencies=[Depends(require_session)])

_COLS = (
    "id, run_id, step_id, kind, external_ref, message, status, "
    "requested_at, resolved_at, resolved_via"
)


class ResolveIn(BaseModel):
    decision: Literal["approved", "rejected"]


def _row(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "run_id": row.run_id,
        "step_id": row.step_id,
        "kind": row.kind,
        "external_ref": row.external_ref,
        "message": row.message,
        "status": row.status,
        "requested_at": row.requested_at,
        "resolved_at": row.resolved_at,
        "resolved_via": row.resolved_via,
    }


async def _release_claim(approval_id: int) -> None:
    """Reopen an approval that was atomically claimed but could not be
    honoured downstream (Hermes call failed, or engine.resume() rejected the
    run-side claim). Restores 'pending' so a legitimate retry is possible
    instead of leaving the approval permanently consumed.
    """
    async with get_session() as session:
        await session.execute(
            text(
                "UPDATE approvals SET status='pending', resolved_at=NULL, "
                "resolved_via=NULL WHERE id=:id"
            ),
            {"id": approval_id},
        )
        await session.commit()


@router.get("/approvals")
async def list_approvals(status: str | None = None) -> list[dict[str, Any]]:
    where = "WHERE status = :status" if status else ""
    params = {"status": status} if status else {}
    async with get_session() as session:
        result = await session.execute(
            text(f"SELECT {_COLS} FROM approvals {where} ORDER BY id DESC"), params
        )
        return [_row(r) for r in result.all()]


@router.post("/approvals/{approval_id}/resolve")
async def resolve_approval(
    approval_id: int, body: ResolveIn, request: Request
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()

    # Read just the metadata needed to decide the path (kind).
    async with get_session() as session:
        meta = (
            await session.execute(
                text("SELECT id, kind, run_id, external_ref, status FROM approvals WHERE id=:id"),
                {"id": approval_id},
            )
        ).one_or_none()
    if meta is None:
        raise HTTPException(404, detail="approval not found")

    if meta.kind == "hermes_run":
        # Hermes-run approvals: atomic claim first (same pattern as the gate
        # branch below), THEN call the external Hermes API, which is the
        # ground truth for these approvals. Only the first caller to win the
        # claim ever calls Hermes.
        async with get_session() as session:
            claimed = (
                await session.execute(
                    text(
                        f"UPDATE approvals SET status=:d, resolved_at=:now, "
                        f"resolved_via='api' WHERE id=:id AND status='pending' "
                        f"RETURNING {_COLS}"
                    ),
                    {"d": body.decision, "now": now, "id": approval_id},
                )
            ).one_or_none()
            await session.commit()
        if claimed is None:
            raise HTTPException(409, detail=f"approval already {meta.status}")

        hermes_run_id, _, hermes_approval_id = (claimed.external_ref or "").partition("|")
        try:
            await request.app.state.engine.hermes().approve_run(
                hermes_run_id, hermes_approval_id, body.decision
            )
        except Exception as exc:
            # Claim already committed locally, but Hermes never received the
            # decision — release the claim so the approval stays resolvable
            # rather than silently losing the decision.
            await _release_claim(approval_id)
            raise HTTPException(
                502,
                detail=f"hermes approve_run failed: {exc}; approval reopened for retry",
            ) from exc

        await append_event(
            "approval.resolved",
            "api",
            f"hermes approval {body.decision}",
            run_id=meta.run_id,
        )
        return _row(claimed)

    # Gate approval: atomic claim so only the first caller wins.
    async with get_session() as session:
        claimed = (
            await session.execute(
                text(
                    f"UPDATE approvals SET status=:d, resolved_at=:now, "
                    f"resolved_via='api' WHERE id=:id AND status='pending' "
                    f"RETURNING {_COLS}"
                ),
                {"d": body.decision, "now": now, "id": approval_id},
            )
        ).one_or_none()
        await session.commit()
    if claimed is None:
        raise HTTPException(409, detail="approval already resolved")

    try:
        await request.app.state.engine.resume(claimed.run_id, body.decision)
    except ValueError as exc:
        # engine.resume()'s own atomic runs-table claim (waiting_approval ->
        # running) failed even though we already committed the approvals
        # claim above. Release the claim back to 'pending' instead of
        # leaving the approval permanently consumed with the run stuck
        # forever (M4-02).
        await _release_claim(approval_id)
        raise HTTPException(
            409,
            detail=f"run not resumable right now ({exc}); approval reopened for retry",
        ) from exc
    return _row(claimed)
