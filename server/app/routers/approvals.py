"""Approvals routes (MASTER_PLAN §5) — resolving a gate resumes its run.

Atomic claim boundary (SPEC R3 / D-APPROVALS): every gate-approval resolution
starts with an atomic ``UPDATE ... WHERE id=:id AND status='pending' RETURNING``
so that the first caller wins.  A concurrent call finds zero rows claimed and
receives HTTP 409.
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

    # Read just the metadata needed to decide the path (kind + run_id).
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
        # Hermes-run approvals: the external Hermes API is the ground truth.
        # Read the full row, call Hermes, then update locally (best-effort).
        if meta.status != "pending":
            raise HTTPException(409, detail=f"approval already {meta.status}")

        hermes_run_id, _, hermes_approval_id = (meta.external_ref or "").partition("|")
        await request.app.state.engine.hermes().approve_run(
            hermes_run_id, hermes_approval_id, body.decision
        )
        async with get_session() as session:
            await session.execute(
                text(
                    "UPDATE approvals SET status=:d, resolved_at=:now, "
                    "resolved_via='api' WHERE id=:id"
                ),
                {"d": body.decision, "now": now, "id": approval_id},
            )
            await session.commit()
        await append_event(
            "approval.resolved",
            "api",
            f"hermes approval {body.decision}",
            run_id=meta.run_id,
        )
        async with get_session() as session:
            updated = (
                await session.execute(
                    text(f"SELECT {_COLS} FROM approvals WHERE id=:id"),
                    {"id": approval_id},
                )
            ).one()
        return _row(updated)

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
    await request.app.state.engine.resume(claimed.run_id, body.decision)
    return _row(claimed)
