"""Per-request metrics and structured logging.

Logs carry operational metadata only. User messages, model prompts/outputs,
worker data, tokens and credentials are never logged (a test enforces it).
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger("fixeditnow.ai")


def configure_logging() -> None:
    """One JSON object per line on stderr (called by the entry points, not by tests)."""
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


@dataclass
class Metrics:
    correlation_id: str
    started: float = field(default_factory=time.perf_counter)
    provider: str | None = None
    model: str | None = None
    mode: str = "simple"
    llm_calls: int = 0
    llm_ms: float = 0.0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    llm_error: str | None = None
    retrieval_ms: float = 0.0
    retrieval: str | None = None  # "lexical" | "hybrid" | "lexical_fallback"
    tool_calls: int = 0
    tool_failures: int = 0
    validation_failures: int = 0
    screen_flags: list[str] = field(default_factory=list)
    kind: str | None = None
    outcome: str = "ok"
    error_category: str | None = None

    def emit(self) -> None:
        record = {
            "event": "ai_chat",
            "correlationId": self.correlation_id,
            "outcome": self.outcome,
            "kind": self.kind,
            "mode": self.mode,
            "provider": self.provider,
            "model": self.model,
            "llmCalls": self.llm_calls,
            "llmMs": round(self.llm_ms),
            "promptTokens": self.prompt_tokens or None,
            "completionTokens": self.completion_tokens or None,
            "llmError": self.llm_error,
            "retrievalMs": round(self.retrieval_ms),
            "retrieval": self.retrieval,
            "toolCalls": self.tool_calls,
            "toolFailures": self.tool_failures,
            "validationFailures": self.validation_failures,
            "screenFlags": self.screen_flags,
            "errorCategory": self.error_category,
            "totalMs": round((time.perf_counter() - self.started) * 1000),
        }
        logger.info(json.dumps({k: v for k, v in record.items() if v not in (None, [], 0, 0.0)}))
