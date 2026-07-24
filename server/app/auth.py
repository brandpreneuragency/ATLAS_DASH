from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pydantic import BaseModel
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import Settings
from app.db import get_session
from app.events import append_event

COOKIE_NAME = "atlas_session"
SESSION_MAX_AGE_S = 7 * 24 * 60 * 60
MIN_PASSWORD_LENGTH = 12

_hasher = PasswordHasher()


class LoginRequest(BaseModel):
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class RateLimiter:
    def __init__(self, max_attempts: int = 5, window_s: int = 300) -> None:
        self.max_attempts = max_attempts
        self.window_s = window_s
        self._attempts: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, key: str) -> bool:
        now = time.monotonic()
        attempts = self._attempts[key]
        while attempts and now - attempts[0] > self.window_s:
            attempts.popleft()
        if len(attempts) >= self.max_attempts:
            return False
        attempts.append(now)
        return True

    def record(self, key: str) -> None:
        """Record an occurrence without enforcing the limit."""
        self._attempts[key].append(time.monotonic())

    def blocked(self, key: str) -> bool:
        """Check the limit without recording an attempt."""
        now = time.monotonic()
        attempts = self._attempts[key]
        while attempts and now - attempts[0] > self.window_s:
            attempts.popleft()
        return len(attempts) >= self.max_attempts


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_session_cookie(secret: str, epoch: int) -> str:
    serializer = URLSafeTimedSerializer(secret, salt="atlas-session")
    return serializer.dumps({"sub": "admin", "epoch": epoch})


def verify_session_cookie(token: str, secret: str, epoch: int) -> dict[str, Any] | None:
    """Validate a session cookie against the CURRENT session epoch.

    The epoch is bumped whenever the password changes, which is what makes
    rotation meaningful: a cookie minted under an older epoch stops being
    accepted, so a stolen session dies with the password it was obtained under.
    """
    serializer = URLSafeTimedSerializer(secret, salt="atlas-session")
    try:
        data = serializer.loads(token, max_age=SESSION_MAX_AGE_S)
    except (BadSignature, SignatureExpired):
        return None
    if not isinstance(data, dict) or data.get("sub") != "admin":
        return None
    return data if data.get("epoch") == epoch else None


async def load_session_epoch() -> int:
    async with get_session() as session:
        value = (
            await session.execute(
                text("SELECT value FROM settings WHERE key = 'session_epoch'")
            )
        ).scalar_one_or_none()
    return int(value) if value is not None else 1


def current_session_epoch(request: Request) -> int | None:
    """The running epoch, or None if it was never loaded.

    None means fail closed. An unset epoch is a startup fault, and the safe
    reading of a startup fault is "nobody is authenticated", not "everybody is".
    """
    epoch = getattr(request.app.state, "session_epoch", None)
    return epoch if isinstance(epoch, int) else None


async def bootstrap_password(settings: Settings) -> None:
    if not settings.password:
        raise RuntimeError("ATLAS_DASH_PASSWORD (or legacy ATLAS_PASSWORD) is required")
    async with get_session() as session:
        existing = (
            await session.execute(
                text("SELECT value FROM settings WHERE key = 'password_hash'")
            )
        ).scalar_one_or_none()
        if existing is None:
            await session.execute(
                text("INSERT INTO settings(key, value) VALUES ('password_hash', :value)"),
                {"value": hash_password(settings.password)},
            )
            await session.commit()

        epoch = (
            await session.execute(
                text("SELECT value FROM settings WHERE key = 'session_epoch'")
            )
        ).scalar_one_or_none()
        if epoch is None:
            await session.execute(
                text("INSERT INTO settings(key, value) VALUES ('session_epoch', '1')")
            )
            await session.commit()


async def require_session(request: Request) -> dict[str, Any]:
    settings: Settings = request.app.state.settings
    token = request.cookies.get(COOKIE_NAME)
    epoch = current_session_epoch(request)
    if (
        token is None
        or epoch is None
        or verify_session_cookie(token, settings.secret_key, epoch) is None
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return {"sub": "admin"}


class CsrfMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if (
            request.url.path.startswith("/api")
            and request.method in {"POST", "PUT", "PATCH", "DELETE"}
            and request.url.path != "/api/auth/login"
            and not request.url.path.startswith("/api/hooks/")
            and request.headers.get("X-Atlas-CSRF") != "1"
        ):
            return JSONResponse({"detail": "CSRF header required"}, status_code=403)
        return await call_next(request)


class ApiAuthMiddleware(BaseHTTPMiddleware):
    _public_paths = {"/api/auth/login", "/api/health"}

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        path = request.url.path
        if path.startswith("/api/hooks/") or path in self._public_paths:
            return await call_next(request)
        if path.startswith("/api"):
            settings: Settings = request.app.state.settings
            token = request.cookies.get(COOKIE_NAME)
            epoch = current_session_epoch(request)
            if (
                token is None
                or epoch is None
                or verify_session_cookie(token, settings.secret_key, epoch) is None
            ):
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return await call_next(request)


def _set_session_cookie(response: Response, settings: Settings, epoch: int) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_session_cookie(settings.secret_key, epoch),
        httponly=True,
        secure=not settings.dev_mode,
        samesite="lax",
        max_age=SESSION_MAX_AGE_S,
    )


def create_auth_router(
    rate_limiter: RateLimiter, failure_limiter: RateLimiter | None = None
) -> APIRouter:
    router = APIRouter(prefix="/api/auth")
    # lockout after 20 FAILED attempts per hour per IP (PHASE_8 Task 8.4)
    failures = failure_limiter or RateLimiter(max_attempts=20, window_s=3600)

    @router.post("/login", status_code=204)
    async def login(payload: LoginRequest, request: Request, response: Response) -> None:
        client_host = request.client.host if request.client else "unknown"
        if failures.blocked(client_host):
            raise HTTPException(
                status_code=429, detail="Locked out after repeated failures"
            )
        if not rate_limiter.hit(client_host):
            raise HTTPException(status_code=429, detail="Too many login attempts")

        async with get_session() as session:
            password_hash = (
                await session.execute(
                    text("SELECT value FROM settings WHERE key = 'password_hash'")
                )
            ).scalar_one()
            if not verify_password(payload.password, password_hash):
                failures.record(client_host)
                raise HTTPException(status_code=401, detail="Invalid password")

        # append_event persists AND publishes to live SSE subscribers.
        await append_event("system.login", "auth", "Signed in")

        settings: Settings = request.app.state.settings
        _set_session_cookie(response, settings, current_session_epoch(request) or 1)

    @router.post("/logout", status_code=204, dependencies=[Depends(require_session)])
    async def logout(response: Response) -> None:
        response.delete_cookie(COOKIE_NAME)

    @router.post(
        "/password", status_code=204, dependencies=[Depends(require_session)]
    )
    async def change_password(
        payload: ChangePasswordRequest, request: Request, response: Response
    ) -> None:
        client_host = request.client.host if request.client else "unknown"
        if failures.blocked(client_host):
            raise HTTPException(
                status_code=429, detail="Locked out after repeated failures"
            )
        if len(payload.new_password) < MIN_PASSWORD_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"New password must be at least {MIN_PASSWORD_LENGTH} characters.",
            )
        if payload.new_password == payload.current_password:
            raise HTTPException(
                status_code=400,
                detail="New password must be different from the current one.",
            )

        async with get_session() as session:
            current_hash = (
                await session.execute(
                    text("SELECT value FROM settings WHERE key = 'password_hash'")
                )
            ).scalar_one()
            if not verify_password(payload.current_password, current_hash):
                failures.record(client_host)
                raise HTTPException(
                    status_code=401, detail="Current password is incorrect"
                )

            await session.execute(
                text("UPDATE settings SET value = :value WHERE key = 'password_hash'"),
                {"value": hash_password(payload.new_password)},
            )
            # Bumping the epoch is what actually revokes every outstanding
            # session, including any cookie stolen under the old password.
            new_epoch = (current_session_epoch(request) or 1) + 1
            await session.execute(
                text("UPDATE settings SET value = :value WHERE key = 'session_epoch'"),
                {"value": str(new_epoch)},
            )
            await session.commit()

        request.app.state.session_epoch = new_epoch
        await append_event("system.password_changed", "auth", "Password changed")

        # The caller just proved they know the current password, so re-mint
        # their cookie under the new epoch rather than logging them out too.
        settings: Settings = request.app.state.settings
        _set_session_cookie(response, settings, new_epoch)

    return router
