"""F10 — POST /api/auth/password.

Until this existed, rotating the product password meant editing the settings
row in SQLite by hand. That mattered from 2026-07-24, when the CP-M5 cutover
removed Caddy basic-auth and left this password as the only gate on the public
host.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import Settings
from app.main import create_app

CSRF = {"X-Atlas-CSRF": "1"}


@pytest_asyncio.fixture
async def two_clients(tmp_path):
    """Two independent, separately-logged-in clients against ONE app.

    Needed because password rotation is only useful if it kicks out sessions
    other than the one doing the rotating - a stolen cookie must stop working.
    """
    settings = Settings(
        data_dir=tmp_path,
        password="testpw",
        secret_key="testsecret",
        mock_hermes=True,
        dev_mode=True,
        static_dir=None,
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://t") as first:
            async with AsyncClient(transport=transport, base_url="http://t") as second:
                for client in (first, second):
                    login = await client.post(
                        "/api/auth/login", json={"password": "testpw"}
                    )
                    assert login.status_code == 204
                yield first, second


async def test_change_password_requires_a_session(app_client):
    response = await app_client.post(
        "/api/auth/password",
        json={"current_password": "testpw", "new_password": "a-brand-new-password"},
        headers=CSRF,
    )
    assert response.status_code == 401


async def test_change_password_rejects_a_wrong_current_password(app_client):
    login = await app_client.post("/api/auth/login", json={"password": "testpw"})
    assert login.status_code == 204

    response = await app_client.post(
        "/api/auth/password",
        json={"current_password": "not-the-password", "new_password": "a-brand-new-password"},
        headers=CSRF,
    )
    assert response.status_code == 401


async def test_change_password_swaps_which_password_logs_in(app_client):
    login = await app_client.post("/api/auth/login", json={"password": "testpw"})
    assert login.status_code == 204

    changed = await app_client.post(
        "/api/auth/password",
        json={"current_password": "testpw", "new_password": "a-brand-new-password"},
        headers=CSRF,
    )
    assert changed.status_code == 204

    await app_client.post("/api/auth/logout", headers=CSRF)

    old = await app_client.post("/api/auth/login", json={"password": "testpw"})
    assert old.status_code == 401

    new = await app_client.post(
        "/api/auth/login", json={"password": "a-brand-new-password"}
    )
    assert new.status_code == 204


async def test_change_password_invalidates_other_sessions(two_clients):
    changer, other = two_clients
    assert (await other.get("/api/me")).status_code == 200

    changed = await changer.post(
        "/api/auth/password",
        json={"current_password": "testpw", "new_password": "a-brand-new-password"},
        headers=CSRF,
    )
    assert changed.status_code == 204

    assert (await other.get("/api/me")).status_code == 401


async def test_change_password_keeps_the_caller_signed_in(two_clients):
    changer, _other = two_clients

    changed = await changer.post(
        "/api/auth/password",
        json={"current_password": "testpw", "new_password": "a-brand-new-password"},
        headers=CSRF,
    )
    assert changed.status_code == 204

    assert (await changer.get("/api/me")).status_code == 200


async def test_change_password_rejects_a_too_short_new_password(app_client):
    assert (
        await app_client.post("/api/auth/login", json={"password": "testpw"})
    ).status_code == 204

    response = await app_client.post(
        "/api/auth/password",
        json={"current_password": "testpw", "new_password": "short"},
        headers=CSRF,
    )
    assert response.status_code == 400
    assert "12" in response.json()["detail"]

    # and the stored password must be untouched
    await app_client.post("/api/auth/logout", headers=CSRF)
    assert (
        await app_client.post("/api/auth/login", json={"password": "testpw"})
    ).status_code == 204


async def test_change_password_rejects_reusing_the_current_password(app_client):
    assert (
        await app_client.post("/api/auth/login", json={"password": "testpw"})
    ).status_code == 204

    response = await app_client.post(
        "/api/auth/password",
        json={"current_password": "testpw", "new_password": "testpw"},
        headers=CSRF,
    )
    assert response.status_code == 400
