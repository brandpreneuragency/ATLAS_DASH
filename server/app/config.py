from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

ENV_PREFIX = "ATLAS_DASH_"
LEGACY_ENV_PREFIX = "ATLAS_"


class ConfigConflictError(RuntimeError):
    """Raised when a legacy ATLAS_* variable and its ATLAS_DASH_* replacement
    are both set to different values for the same setting."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix=ENV_PREFIX)

    data_dir: Path = Path("/data")
    atlas_root: Path = Path("/opt/atlas")
    hermes_runs_url: str = "http://hermes:8642"
    hermes_admin_url: str = "http://hermes:9119"
    hermes_api_key: str = ""
    password: str = ""
    secret_key: str = ""
    tz: str = "Europe/Istanbul"
    port: int = 8700
    static_dir: Path | None = Path("/app/static")
    mock_hermes: bool = False
    dev_mode: bool = False
    public_url: str = "https://atlas.brandpreneur.net"


def _legacy_env_overrides(env: dict[str, str] | None = None) -> dict[str, Any]:
    """Resolve ``ATLAS_DASH_*``/legacy ``ATLAS_*`` precedence for every field.

    ``ATLAS_DASH_*`` always wins when only it is set. When both the new and
    legacy variable are set to the *same* value, the new one wins and nothing
    is logged. When both are set to *different* values this is an operator
    error and must fail clearly rather than silently pick one -- raises
    :class:`ConfigConflictError`, naming the two variables but never their
    values. When only the legacy variable is set, it is accepted as a tested
    fallback and a deprecation warning names the variable (never its value).
    """
    source = env if env is not None else os.environ
    overrides: dict[str, Any] = {}
    for field_name in Settings.model_fields:
        new_key = f"{ENV_PREFIX}{field_name.upper()}"
        old_key = f"{LEGACY_ENV_PREFIX}{field_name.upper()}"
        old_val = source.get(old_key)
        if old_val is None:
            continue
        new_val = source.get(new_key)
        if new_val is not None:
            if new_val != old_val:
                raise ConfigConflictError(
                    f"Conflicting configuration for {new_key!r} and legacy "
                    f"{old_key!r}: they are set to different values. Remove "
                    "the legacy variable or make both values match."
                )
            continue
        logger.warning(
            "Using deprecated legacy environment variable %s; set %s instead.",
            old_key,
            new_key,
        )
        overrides[field_name] = old_val
    return overrides


def get_settings() -> Settings:
    return Settings(**_legacy_env_overrides())
