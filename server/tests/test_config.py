import logging
from pathlib import Path

import pytest

from app.auth import bootstrap_password
from app.config import ConfigConflictError, Settings, _legacy_env_overrides, get_settings


def test_legacy_overrides_empty_when_nothing_set():
    assert _legacy_env_overrides({}) == {}


def test_new_prefix_only_is_not_an_override():
    # ATLAS_DASH_* alone needs no override; the normal env source handles it.
    env = {"ATLAS_DASH_PASSWORD": "new-pw"}
    assert _legacy_env_overrides(env) == {}


def test_legacy_prefix_only_falls_back():
    env = {"ATLAS_PASSWORD": "legacy-pw"}
    assert _legacy_env_overrides(env) == {"password": "legacy-pw"}


def test_new_and_legacy_same_value_is_not_a_conflict():
    env = {"ATLAS_DASH_PASSWORD": "same-pw", "ATLAS_PASSWORD": "same-pw"}
    assert _legacy_env_overrides(env) == {}


def test_new_and_legacy_different_values_raise_conflict():
    env = {"ATLAS_DASH_PASSWORD": "new-pw", "ATLAS_PASSWORD": "legacy-pw"}
    with pytest.raises(ConfigConflictError):
        _legacy_env_overrides(env)


def test_conflict_error_names_variables_not_values():
    env = {"ATLAS_DASH_SECRET_KEY": "new-secret", "ATLAS_SECRET_KEY": "old-secret"}
    with pytest.raises(ConfigConflictError) as exc_info:
        _legacy_env_overrides(env)
    message = str(exc_info.value)
    assert "ATLAS_DASH_SECRET_KEY" in message
    assert "ATLAS_SECRET_KEY" in message
    assert "new-secret" not in message
    assert "old-secret" not in message


def test_legacy_fallback_warning_names_variable_not_value(caplog):
    with caplog.at_level(logging.WARNING):
        _legacy_env_overrides({"ATLAS_PASSWORD": "super-secret-value"})
    warnings = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert any("ATLAS_PASSWORD" in w and "ATLAS_DASH_PASSWORD" in w for w in warnings)
    assert not any("super-secret-value" in w for w in warnings)


def test_get_settings_reads_new_prefix(monkeypatch, tmp_path):
    monkeypatch.setenv("ATLAS_DASH_PASSWORD", "from-new")
    monkeypatch.setenv("ATLAS_DASH_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("ATLAS_PASSWORD", raising=False)
    settings = get_settings()
    assert settings.password == "from-new"


def test_get_settings_falls_back_to_legacy_prefix(monkeypatch, tmp_path):
    monkeypatch.delenv("ATLAS_DASH_PASSWORD", raising=False)
    monkeypatch.setenv("ATLAS_PASSWORD", "from-legacy")
    monkeypatch.setenv("ATLAS_DASH_DATA_DIR", str(tmp_path))
    settings = get_settings()
    assert settings.password == "from-legacy"


def test_get_settings_new_prefix_precedence_when_both_differ(monkeypatch, tmp_path):
    monkeypatch.setenv("ATLAS_DASH_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ATLAS_DASH_PASSWORD", "from-new")
    monkeypatch.setenv("ATLAS_PASSWORD", "from-legacy")
    with pytest.raises(ConfigConflictError):
        get_settings()


def test_direct_construction_unaffected_by_env(monkeypatch, tmp_path):
    # Existing tests/fixtures construct Settings(...) directly; this must
    # keep working exactly as before, independent of the env-fallback layer.
    monkeypatch.setenv("ATLAS_PASSWORD", "ignored-because-constructed-directly")
    settings = Settings(data_dir=tmp_path, password="explicit", secret_key="s")
    assert settings.password == "explicit"


async def test_bootstrap_password_missing_secret_fails_clearly(tmp_path):
    settings = Settings(data_dir=tmp_path, password="")
    with pytest.raises(RuntimeError) as exc_info:
        await bootstrap_password(settings)
    message = str(exc_info.value)
    assert "ATLAS_DASH_PASSWORD" in message
    assert "ATLAS_PASSWORD" in message


# --- F1 (phase-3 review): non-string field types through the legacy path ---


def test_legacy_fallback_bool_field_correct_type(monkeypatch, tmp_path):
    monkeypatch.delenv("ATLAS_DASH_MOCK_HERMES", raising=False)
    monkeypatch.setenv("ATLAS_MOCK_HERMES", "1")
    monkeypatch.setenv("ATLAS_DASH_DATA_DIR", str(tmp_path))
    settings = get_settings()
    assert settings.mock_hermes is True


def test_legacy_fallback_int_field_correct_type(monkeypatch, tmp_path):
    monkeypatch.delenv("ATLAS_DASH_PORT", raising=False)
    monkeypatch.setenv("ATLAS_PORT", "9999")
    monkeypatch.setenv("ATLAS_DASH_DATA_DIR", str(tmp_path))
    settings = get_settings()
    assert settings.port == 9999
    assert isinstance(settings.port, int)


def test_legacy_fallback_path_field_correct_type(monkeypatch, tmp_path):
    monkeypatch.delenv("ATLAS_DASH_DATA_DIR", raising=False)
    monkeypatch.setenv("ATLAS_DATA_DIR", str(tmp_path))
    settings = get_settings()
    assert settings.data_dir == tmp_path
    assert isinstance(settings.data_dir, Path)


# --- F2 (phase-3 review): ATLAS_DASH_* precedence must not depend on case ---


def test_lowercase_new_prefix_alone_is_recognized(monkeypatch, tmp_path):
    monkeypatch.delenv("ATLAS_PASSWORD", raising=False)
    monkeypatch.setenv("atlas_dash_password", "lower-new")
    monkeypatch.setenv("ATLAS_DASH_DATA_DIR", str(tmp_path))
    settings = get_settings()
    assert settings.password == "lower-new"


def test_lowercase_new_prefix_same_value_as_legacy_is_not_a_conflict(monkeypatch, tmp_path):
    monkeypatch.setenv("atlas_dash_password", "same-value")
    monkeypatch.setenv("ATLAS_PASSWORD", "same-value")
    monkeypatch.setenv("ATLAS_DASH_DATA_DIR", str(tmp_path))
    settings = get_settings()
    assert settings.password == "same-value"


def test_lowercase_new_prefix_conflicting_legacy_value_fails_clearly(monkeypatch, tmp_path):
    # Regression test for the phase-3 finding: a non-uppercase ATLAS_DASH_*
    # variable must still be recognized as present (pydantic-settings' own
    # EnvSettingsSource is case-insensitive), so a differing legacy value
    # here must raise, never silently resolve to the legacy value.
    monkeypatch.setenv("atlas_dash_password", "lower-new")
    monkeypatch.setenv("ATLAS_PASSWORD", "upper-legacy")
    monkeypatch.setenv("ATLAS_DASH_DATA_DIR", str(tmp_path))
    with pytest.raises(ConfigConflictError):
        get_settings()
