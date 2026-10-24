"""FastAPI application: the only entry point to the AI service.

Only the main API calls it (bearer service token). Browsers never reach it.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import re
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import ConfigError, Settings, load_settings
from app.knowledge import KnowledgeBase
from app.limits import RateLimiter
from app.llm.base import LLMClient, LLMError
from app.llm.openrouter import OpenRouterClient
from app.marketplace import MarketplaceClient, MarketplaceError
from app.obs import Metrics, configure_logging
from app.pipeline import Pipeline
from app.schemas import ChatRequest, ChatResponse

MAX_BODY_BYTES = 16 * 1024
_CORRELATION = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
log = logging.getLogger("fixeditnow.ai")


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": code, "message": message})


def create_app(
    settings: Settings | None = None,
    *,
    llm: LLMClient | None = None,
    http: httpx.AsyncClient | None = None,
) -> FastAPI:
    cfg = settings or load_settings()
    knowledge = KnowledgeBase.load(cfg.knowledge_dir)
    limiter = RateLimiter(cfg.rate_limit_per_minute)
    gate = asyncio.Semaphore(cfg.max_concurrent_requests)
    state: dict[str, Any] = {}

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        client = http or httpx.AsyncClient()
        model: LLMClient | None = llm
        if model is None and cfg.llm_configured:
            model = OpenRouterClient(cfg, client)
        if model is None:
            log.warning("OpenRouter is not configured: running in simple (non-LLM) mode")
        state["pipeline"] = Pipeline(model, MarketplaceClient(cfg, client), knowledge, cfg.max_results)
        state["llm"] = model
        try:
            yield
        finally:
            if http is None:
                await client.aclose()

    app = FastAPI(
        title="FixedItNow AI service",
        lifespan=lifespan,
        docs_url="/docs" if cfg.app_env == "development" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if cfg.app_env == "development" else None,
    )

    @app.exception_handler(RequestValidationError)
    async def _invalid(_: Request, __: RequestValidationError) -> JSONResponse:
        # Never echo the submitted values back.
        return _error(400, "INVALID_INPUT", "The request was not valid.")

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, __: Exception) -> JSONResponse:
        return _error(500, "INTERNAL", "The assistant hit an internal error.")

    def require_service(authorization: Annotated[str | None, Header()] = None) -> None:
        expected = cfg.ai_service_token.get_secret_value().encode()
        scheme, _, supplied = (authorization or "").partition(" ")
        # Always compare, so a wrong scheme and a wrong token take the same path.
        if not (hmac.compare_digest(supplied.encode(), expected) and scheme == "Bearer"):
            raise _Unauthorized

    class _Unauthorized(Exception):
        pass

    @app.exception_handler(_Unauthorized)
    async def _unauthorized(_: Request, __: _Unauthorized) -> JSONResponse:
        return _error(401, "UNAUTHORIZED", "Service authentication failed.")

    @app.get("/health")
    async def health() -> dict[str, object]:
        """Liveness plus non-secret capability flags."""
        return {
            "status": "ok",
            "llm": "configured" if state.get("llm") is not None else "not_configured",
            "knowledgeChunks": len(knowledge.chunks),
        }

    @app.post("/v1/chat", response_model=ChatResponse, response_model_by_alias=True, dependencies=[Depends(require_service)])
    async def chat(
        request: Request,
        body: ChatRequest,
        x_correlation_id: Annotated[str | None, Header()] = None,
        x_subject: Annotated[str | None, Header()] = None,
    ) -> Any:
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            return _error(413, "INVALID_INPUT", "The request is too large.")
        correlation = x_correlation_id if x_correlation_id and _CORRELATION.match(x_correlation_id) else uuid.uuid4().hex
        metrics = Metrics(correlation)
        subject = hashlib.sha256((x_subject or "anonymous").encode()).hexdigest()[:24]
        if not limiter.allow(subject):
            metrics.outcome, metrics.error_category = "error", "rate_limited"
            metrics.emit()
            return _error(429, "RATE_LIMITED", "Too many assistant requests. Please wait a moment.")
        if gate.locked():
            metrics.outcome, metrics.error_category = "error", "busy"
            metrics.emit()
            return _error(503, "BUSY", "The assistant is busy. Please try again shortly.")
        async with gate:
            try:
                response: ChatResponse = await asyncio.wait_for(
                    state["pipeline"].handle(body, metrics), timeout=cfg.request_timeout_seconds * 2
                )
            except MarketplaceError:
                metrics.outcome, metrics.error_category = "error", "marketplace_unavailable"
                return _error(503, "MARKETPLACE_UNAVAILABLE", "Marketplace data is unavailable right now.")
            except (LLMError, TimeoutError):
                metrics.outcome, metrics.error_category = "error", "provider_failure"
                return _error(503, "BUSY", "The assistant is busy. Please try again shortly.")
            except Exception:
                metrics.outcome, metrics.error_category = "error", "internal"
                raise
            finally:
                metrics.emit()
        return response

    return app


def app_from_env() -> FastAPI:  # uvicorn app.main:app_from_env --factory
    configure_logging()
    try:
        return create_app()
    except ConfigError as error:
        raise SystemExit(str(error)) from None
