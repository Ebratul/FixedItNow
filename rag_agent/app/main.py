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
from app.knowledge import KnowledgeBase, KnowledgeError
from app.limits import RateLimiter
from app.llm.base import LLMClient, LLMError
from app.llm.openrouter import OpenRouterClient
from app.marketplace import MarketplaceClient, MarketplaceError
from app.obs import Metrics, configure_logging
from app.pipeline import Pipeline
from app.schemas import ChatRequest, ChatResponse
from app.vector_store import PineconeStore, VectorError

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
    state: dict[str, Any] = {"knowledge": KnowledgeBase.load(cfg.knowledge_dir)}
    reload_lock = asyncio.Lock()
    limiter = RateLimiter(cfg.rate_limit_per_minute)
    gate = asyncio.Semaphore(cfg.max_concurrent_requests)

    async def load_knowledge(marketplace: MarketplaceClient) -> KnowledgeBase:
        """Build a fresh index from the configured source. Raises KnowledgeError / MarketplaceError."""
        if cfg.knowledge_source == "api":
            return KnowledgeBase.from_documents(await marketplace.knowledge_documents())
        return KnowledgeBase.load(cfg.knowledge_dir)

    async def sync_vectors(kb: KnowledgeBase) -> None:
        """Push the knowledge base to Pinecone. A failure is logged (no secrets) and retrieval stays lexical."""
        store: PineconeStore | None = state.get("vectors")
        if store is None:
            return
        try:
            report = await store.sync(kb)
            log.info("Pinecone sync ok: %d upserted, %d deleted", report.upserted, report.deleted)
        except VectorError as error:
            log.warning("Pinecone sync failed (%s): using lexical retrieval", error)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        client = http or httpx.AsyncClient()
        model: LLMClient | None = llm
        if model is None and cfg.llm_configured:
            model = OpenRouterClient(cfg, client)
        if model is None:
            log.warning("OpenRouter is not configured: running in simple (non-LLM) mode")
        marketplace = MarketplaceClient(cfg, client)
        if cfg.knowledge_source == "api":
            try:
                state["knowledge"] = await load_knowledge(marketplace)
            except (KnowledgeError, MarketplaceError):
                # The bundled files keep the assistant useful until an administrator syncs.
                log.warning("Admin-managed knowledge could not be loaded: using the bundled files for now")
        state["marketplace"] = marketplace
        vectors = PineconeStore(cfg, client) if cfg.pinecone_configured else None
        state["vectors"] = vectors
        state["pipeline"] = Pipeline(model, marketplace, state["knowledge"], cfg.max_results, vectors)
        await sync_vectors(state["knowledge"])
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
            "knowledgeChunks": len(state["knowledge"].chunks),
            "vectorSearch": vector_state(),
        }

    def vector_state() -> str:
        store: PineconeStore | None = state.get("vectors")
        if store is None:
            return "not_configured"
        return "synced" if store.status.synced_digest == state["knowledge"].digest else "not_synced"

    def knowledge_summary() -> dict[str, object]:
        kb: KnowledgeBase = state["knowledge"]
        return {"source": kb.source, "documents": len({c.doc_id for c in kb.chunks}), "chunks": len(kb.chunks), "digest": kb.digest, "vectorSearch": vector_state()}

    @app.get("/v1/knowledge", dependencies=[Depends(require_service)])
    async def knowledge_status() -> dict[str, object]:
        """What the running index was built from (for the admin panel). No document text."""
        return {**knowledge_summary(), "configuredSource": cfg.knowledge_source}

    @app.post("/v1/knowledge/reload", dependencies=[Depends(require_service)])
    async def knowledge_reload() -> Any:
        """Rebuild the index from the configured source and swap it in atomically. On any failure the
        previous index keeps serving and nothing is partially applied."""
        async with reload_lock:
            try:
                fresh = await load_knowledge(state["marketplace"])
            except (KnowledgeError, MarketplaceError):
                return _error(502, "KNOWLEDGE_UNAVAILABLE", "The knowledge source could not be read or was not valid. The previous knowledge is still in use.")
            state["knowledge"] = fresh
            state["pipeline"].knowledge = fresh
            await sync_vectors(fresh)
        return {**knowledge_summary(), "configuredSource": cfg.knowledge_source}

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
