"""Environment configuration, validated at startup.

Failure messages name the variable and the rule, never the value, so a bad
secret cannot leak through an error message or a log line.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, SecretStr

MIN_TOKEN_LENGTH = 32


class ConfigError(Exception):
    """Raised with a list of human-readable problems (no secret values)."""


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True)

    app_env: Literal["development", "test", "production"] = "production"
    host: str = "127.0.0.1"
    port: int = 8000

    ai_service_token: SecretStr
    app_api_service_token: SecretStr
    app_api_base_url: str

    openrouter_api_key: SecretStr | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str | None = None
    openrouter_response_format: Literal["json_schema", "json_object", "none"] = "json_schema"
    openrouter_app_url: str | None = None
    openrouter_app_title: str = "FixedItNow"

    request_timeout_seconds: float = 30.0
    max_output_tokens: int = 1200
    rate_limit_per_minute: int = 10
    max_results: int = 5
    max_concurrent_requests: int = 8

    knowledge_dir: Path

    @property
    def llm_configured(self) -> bool:
        return bool(self.openrouter_api_key and self.openrouter_model)


def _clean(env: Mapping[str, str], key: str) -> str | None:
    value = env.get(key)
    if value is None:
        return None
    value = value.strip()
    return value or None


def _int(env: Mapping[str, str], key: str, default: int, low: int, high: int, errors: list[str]) -> int:
    raw = _clean(env, key)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        errors.append(f"{key} must be an integer")
        return default
    if not low <= value <= high:
        errors.append(f"{key} must be between {low} and {high}")
        return default
    return value


_LOOPBACK = ("localhost", "127.0.0.1", "::1")


def _http_url(
    value: str, key: str, errors: list[str], *, https_only: bool = False, allow_loopback_http: bool = False
) -> None:
    parsed = urlparse(value)
    schemes = ("https",) if https_only else ("http", "https")
    ok = parsed.scheme in schemes and bool(parsed.netloc)
    if https_only and parsed.scheme == "http" and allow_loopback_http and parsed.hostname in _LOOPBACK:
        ok = True  # local fakes in development/test only
    if not ok:
        errors.append(f"{key} must be an {'/'.join(schemes)} URL")


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    source = os.environ if env is None else env
    errors: list[str] = []

    app_env = _clean(source, "APP_ENV") or "production"  # safe default: no API docs, no loopback fakes
    if app_env not in ("development", "test", "production"):
        errors.append("APP_ENV must be development, test or production")
        app_env = "production"

    ai_token = _clean(source, "AI_SERVICE_TOKEN")
    api_token = _clean(source, "APP_API_SERVICE_TOKEN")
    for key, token in (("AI_SERVICE_TOKEN", ai_token), ("APP_API_SERVICE_TOKEN", api_token)):
        if token is None:
            errors.append(f"{key} is required")
        elif len(token) < MIN_TOKEN_LENGTH:
            errors.append(f"{key} must be at least {MIN_TOKEN_LENGTH} characters")
    if ai_token and api_token and ai_token == api_token:
        errors.append("AI_SERVICE_TOKEN and APP_API_SERVICE_TOKEN must be different secrets")

    api_base = _clean(source, "APP_API_BASE_URL")
    if api_base is None:
        errors.append("APP_API_BASE_URL is required")
    else:
        _http_url(api_base, "APP_API_BASE_URL", errors)

    or_base = _clean(source, "OPENROUTER_BASE_URL") or "https://openrouter.ai/api/v1"
    _http_url(or_base, "OPENROUTER_BASE_URL", errors, https_only=True, allow_loopback_http=app_env != "production")

    fmt: str = _clean(source, "OPENROUTER_RESPONSE_FORMAT") or "json_schema"
    if fmt not in ("json_schema", "json_object", "none"):
        errors.append("OPENROUTER_RESPONSE_FORMAT must be json_schema, json_object or none")
        fmt = "json_schema"

    or_key = _clean(source, "OPENROUTER_API_KEY")
    model = _clean(source, "OPENROUTER_MODEL")
    if bool(or_key) != bool(model):
        errors.append("Set both OPENROUTER_API_KEY and OPENROUTER_MODEL, or neither")

    timeout_raw = _clean(source, "AI_REQUEST_TIMEOUT_SECONDS")
    timeout = 30.0
    if timeout_raw is not None:
        try:
            timeout = float(timeout_raw)
        except ValueError:
            errors.append("AI_REQUEST_TIMEOUT_SECONDS must be a number")
        else:
            if not 1 <= timeout <= 120:
                errors.append("AI_REQUEST_TIMEOUT_SECONDS must be between 1 and 120")
                timeout = 30.0

    knowledge = _clean(source, "AI_KNOWLEDGE_DIR")
    knowledge_dir = Path(knowledge) if knowledge else Path(__file__).resolve().parent.parent / "knowledge"

    settings_kwargs = {
        "app_env": app_env,
        "host": _clean(source, "AI_HOST") or "127.0.0.1",
        "port": _int(source, "AI_PORT", 8000, 1, 65535, errors),
        "ai_service_token": SecretStr(ai_token or ""),
        "app_api_service_token": SecretStr(api_token or ""),
        "app_api_base_url": (api_base or "").rstrip("/"),
        "openrouter_api_key": SecretStr(or_key) if or_key else None,
        "openrouter_base_url": or_base.rstrip("/"),
        "openrouter_model": model,
        "openrouter_response_format": fmt,
        "openrouter_app_url": _clean(source, "OPENROUTER_APP_URL"),
        "openrouter_app_title": _clean(source, "OPENROUTER_APP_TITLE") or "FixedItNow",
        "request_timeout_seconds": timeout,
        "max_output_tokens": _int(source, "AI_MAX_OUTPUT_TOKENS", 1200, 100, 8000, errors),
        "rate_limit_per_minute": _int(source, "AI_RATE_LIMIT_PER_MINUTE", 10, 1, 600, errors),
        "max_results": _int(source, "AI_MAX_RESULTS", 5, 1, 10, errors),
        "max_concurrent_requests": _int(source, "AI_MAX_CONCURRENT_REQUESTS", 8, 1, 100, errors),
        "knowledge_dir": knowledge_dir,
    }
    if errors:
        raise ConfigError("Invalid AI service configuration:\n" + "\n".join(f"  - {e}" for e in errors))
    return Settings(**settings_kwargs)
