"""Environment configuration, validated at startup.

Failure messages name the variable and the rule, never the value, so a bad
secret cannot leak through an error message or a log line.
"""

from __future__ import annotations

import os
import re
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
    # "files": knowledge/*.md shipped with the service. "api": documents managed by administrators in the
    # main API (published only); the files are the fallback if the API cannot be reached at start-up.
    knowledge_source: Literal["files", "api"] = "files"

    # Optional Pinecone vector retrieval (an integrated-embedding index). Both the key and the host, or neither.
    pinecone_api_key: SecretStr | None = None
    pinecone_index_host: str | None = None
    pinecone_namespace: str = "fixeditnow-knowledge"
    pinecone_api_version: str = "2025-10"
    pinecone_text_field: str = "chunk_text"
    pinecone_top_k: int = 6
    pinecone_min_score: float = 0.8
    pinecone_timeout_seconds: float = 5.0

    @property
    def pinecone_configured(self) -> bool:
        return self.pinecone_api_key is not None and self.pinecone_index_host is not None

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

    knowledge_source = _clean(source, "AI_KNOWLEDGE_SOURCE") or "files"
    if knowledge_source not in ("files", "api"):
        errors.append("AI_KNOWLEDGE_SOURCE must be files or api")
        knowledge_source = "files"

    knowledge = _clean(source, "AI_KNOWLEDGE_DIR")
    knowledge_dir = Path(knowledge) if knowledge else Path(__file__).resolve().parent.parent / "knowledge"

    pc_key = _clean(source, "PINECONE_API_KEY")
    pc_host = _clean(source, "PINECONE_INDEX_HOST")
    if bool(pc_key) != bool(pc_host):
        errors.append("Set both PINECONE_API_KEY and PINECONE_INDEX_HOST, or neither")
    if pc_host:
        if "://" not in pc_host:
            pc_host = f"https://{pc_host}"  # the console shows the bare host name
        _http_url(pc_host, "PINECONE_INDEX_HOST", errors, https_only=True, allow_loopback_http=app_env != "production")
    pc_namespace = _clean(source, "PINECONE_NAMESPACE") or "fixeditnow-knowledge"
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", pc_namespace):
        errors.append("PINECONE_NAMESPACE must be 1-64 letters, digits, '-' or '_'")
        pc_namespace = "fixeditnow-knowledge"
    pc_field = _clean(source, "PINECONE_TEXT_FIELD") or "chunk_text"
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,63}", pc_field):
        errors.append("PINECONE_TEXT_FIELD must be a plain field name")
        pc_field = "chunk_text"
    pc_version = _clean(source, "PINECONE_API_VERSION") or "2025-10"
    if not re.fullmatch(r"\d{4}-\d{2}", pc_version):
        errors.append("PINECONE_API_VERSION must look like 2025-10")
        pc_version = "2025-10"
    pc_score = 0.8
    raw_score = _clean(source, "PINECONE_MIN_SCORE")
    if raw_score is not None:
        try:
            pc_score = float(raw_score)
        except ValueError:
            errors.append("PINECONE_MIN_SCORE must be a number")
        else:
            if not 0 <= pc_score <= 1:
                errors.append("PINECONE_MIN_SCORE must be between 0 and 1")
                pc_score = 0.8

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
        "knowledge_source": knowledge_source,
        "pinecone_api_key": SecretStr(pc_key) if pc_key else None,
        "pinecone_index_host": pc_host.rstrip("/") if pc_host else None,
        "pinecone_namespace": pc_namespace,
        "pinecone_api_version": pc_version,
        "pinecone_text_field": pc_field,
        "pinecone_top_k": _int(source, "PINECONE_TOP_K", 6, 1, 20, errors),
        "pinecone_min_score": pc_score,
    }
    if errors:
        raise ConfigError("Invalid AI service configuration:\n" + "\n".join(f"  - {e}" for e in errors))
    return Settings(**settings_kwargs)
