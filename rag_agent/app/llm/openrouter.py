"""OpenRouter adapter (server-side only).

Contract used (https://openrouter.ai/docs): POST {base}/chat/completions with
`Authorization: Bearer <key>`, body {model, messages, max_tokens, temperature,
response_format?, provider?}. Errors are `{"error": {"code", "message"}}` with the
same HTTP status; a 200 may still carry a top-level `error` and no `choices`.

Structured-output support is per model *endpoint* and can change, so:
* the response format is configuration (`OPENROUTER_RESPONSE_FORMAT`);
* when a format is requested we send `provider.require_parameters = true`, which
  makes OpenRouter route only to endpoints that support it (or fail);
* an unsupported-feature failure is reported, not silently retried on another
  model: there is intentionally no fallback model.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings
from app.llm.base import LLMError, LLMErrorCategory, LLMResult

MAX_CONTENT_CHARS = 20_000


def _category_for_status(status: int) -> LLMErrorCategory:
    if status in (401, 403):
        return "auth"
    if status == 402:
        return "insufficient_credits"
    if status in (408, 504):
        return "timeout"
    if status == 429:
        return "rate_limited"
    if status in (400, 404, 422):
        return "unsupported_feature"
    return "provider_error"


class OpenRouterClient:
    provider = "openrouter"

    def __init__(self, settings: Settings, http: httpx.AsyncClient) -> None:
        if not settings.llm_configured:
            raise LLMError("not_configured")
        assert settings.openrouter_api_key is not None and settings.openrouter_model is not None
        self._url = f"{settings.openrouter_base_url}/chat/completions"
        self._key = settings.openrouter_api_key
        self.model = settings.openrouter_model
        self._format = settings.openrouter_response_format
        self._timeout = settings.request_timeout_seconds
        self._http = http
        self._headers_extra: dict[str, str] = {"X-Title": settings.openrouter_app_title}
        if settings.openrouter_app_url:
            self._headers_extra["HTTP-Referer"] = settings.openrouter_app_url

    def _body(
        self, system: str, user: str, schema_name: str, schema: dict[str, Any], max_tokens: int
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "max_tokens": max_tokens,
            "temperature": 0,
            "stream": False,
        }
        if self._format == "json_schema":
            body["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            }
            body["provider"] = {"require_parameters": True}
        elif self._format == "json_object":
            body["response_format"] = {"type": "json_object"}
            body["provider"] = {"require_parameters": True}
        return body

    async def complete_json(
        self,
        *,
        system: str,
        user: str,
        schema_name: str,
        schema: dict[str, Any],
        max_tokens: int,
    ) -> LLMResult:
        headers = {
            "Authorization": f"Bearer {self._key.get_secret_value()}",
            "Content-Type": "application/json",
            **self._headers_extra,
        }
        try:
            response = await self._http.post(
                self._url,
                headers=headers,
                json=self._body(system, user, schema_name, schema, max_tokens),
                timeout=self._timeout,
            )
        except httpx.TimeoutException:
            raise LLMError("timeout") from None
        except httpx.HTTPError:
            # Not chained: the exception text can contain the request URL/headers.
            raise LLMError("provider_error") from None

        if response.status_code != 200:
            raise LLMError(_category_for_status(response.status_code), response.status_code)

        try:
            payload = response.json()
        except ValueError:
            raise LLMError("malformed_response", 200) from None
        if not isinstance(payload, dict):
            raise LLMError("malformed_response", 200)

        error = payload.get("error")
        if error is not None and not payload.get("choices"):
            code = error.get("code") if isinstance(error, dict) else None
            status = code if isinstance(code, int) else 502
            raise LLMError(_category_for_status(status), status)

        try:
            choice = payload["choices"][0]
            content = choice["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise LLMError("malformed_response", 200) from None
        if not isinstance(content, str) or not content.strip():
            raise LLMError("empty_response", 200)
        if len(content) > MAX_CONTENT_CHARS:
            raise LLMError("malformed_response", 200)

        raw_usage = payload.get("usage")
        usage: dict[str, Any] = raw_usage if isinstance(raw_usage, dict) else {}
        return LLMResult(
            content=content,
            model=payload.get("model") if isinstance(payload.get("model"), str) else None,
            prompt_tokens=usage.get("prompt_tokens") if isinstance(usage.get("prompt_tokens"), int) else None,
            completion_tokens=(
                usage.get("completion_tokens") if isinstance(usage.get("completion_tokens"), int) else None
            ),
        )
