"""Provider-neutral language-model interface.

Business logic depends on `LLMClient` only; OpenRouter is one implementation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Protocol

LLMErrorCategory = Literal[
    "not_configured",
    "timeout",
    "rate_limited",
    "auth",
    "insufficient_credits",
    "unsupported_feature",
    "provider_error",
    "empty_response",
    "malformed_response",
]


class LLMError(Exception):
    """A provider failure reduced to a category. It never carries the provider's
    message body (which may echo prompt content) or any credential."""

    def __init__(self, category: LLMErrorCategory, status: int | None = None) -> None:
        super().__init__(category)
        self.category = category
        self.status = status


@dataclass(frozen=True)
class LLMResult:
    content: str
    model: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


class LLMClient(Protocol):
    provider: str
    model: str

    async def complete_json(
        self,
        *,
        system: str,
        user: str,
        schema_name: str,
        schema: dict[str, Any],
        max_tokens: int,
    ) -> LLMResult: ...
