"""Pinecone (cloud vector database) retrieval for the curated knowledge base.

How it fits:
  * The knowledge text still lives in `knowledge/*.md` or in the administrator-managed documents served by the main
    API, exactly as before. `KnowledgeBase` chunks it with stable ids.
  * `PineconeStore.sync(kb)` upserts those chunks into a Pinecone *integrated-embedding* index (Pinecone embeds the text
    with the index's hosted model on both write and search; no embedding code or second provider here) and deletes
    ids that are no longer in the knowledge base. Repeating it changes nothing (same ids, same text).
  * `search` sends the question to Pinecone and gets back ONLY ids and scores. The text shown to users and given to the
    language model always comes from the local, validated chunks, so the index can never inject content, and an id the
    knowledge base does not know (stale index) is ignored.
  * Retrieval is hybrid: the existing lexical (BM25) ranking and its "must cover the question's terms" gate stay, and the
    vector hits (above a score floor) are fused with them. If Pinecone is down, slow or not yet synced, the assistant
    silently uses lexical retrieval alone: the cloud index is an improvement, never a dependency.

What is sent to Pinecone: the public knowledge text (audience "public" only) at sync time, and the user's knowledge
question at search time (after the safety screen has refused private-data requests). Nothing about workers, bookings or
accounts. The API key is a SecretStr: it is never logged, returned by /health, or put in an error message.

UNVERIFIED against a real Pinecone project (no key was available when this was written): the request shapes follow
Pinecone's published REST reference (records upsert/search, vectors list/delete), and everything is tested against a mock.
Run `python -m app.vector_store check` once with your key.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

import httpx

from app.config import Settings
from app.knowledge import Chunk, Hit, KnowledgeBase

log = logging.getLogger("fixeditnow.ai")

UPSERT_BATCH = 96  # Pinecone's limit for text records
DELETE_BATCH = 100
LIST_PAGE = 100
MAX_LIST_PAGES = 200  # 20,000 ids: far above any curated corpus; a runaway listing must end


class VectorError(Exception):
    """Any Pinecone failure. The message never contains the key or response bodies."""


@dataclass
class SyncReport:
    upserted: int = 0
    deleted: int = 0
    digest: str = ""


@dataclass
class VectorStatus:
    configured: bool = False
    synced_digest: str | None = None
    last_error: str | None = None
    state: dict[str, object] = field(default_factory=dict)


class PineconeStore:
    def __init__(self, settings: Settings, http: httpx.AsyncClient) -> None:
        assert settings.pinecone_api_key is not None and settings.pinecone_index_host is not None
        self._s = settings
        self._http = http
        self._base = settings.pinecone_index_host.rstrip("/")
        self.status = VectorStatus(configured=True)

    # -- transport ------------------------------------------------------------------

    def _headers(self, content_type: str = "application/json") -> dict[str, str]:
        return {
            "Api-Key": self._s.pinecone_api_key.get_secret_value(),  # type: ignore[union-attr]
            "X-Pinecone-Api-Version": self._s.pinecone_api_version,
            "Content-Type": content_type,
            "Accept": "application/json",
        }

    async def _call(self, method: str, path: str, *, params: dict[str, str | int] | None = None,
                    json_body: object | None = None, content: str | None = None) -> dict[str, object]:
        try:
            response = await self._http.request(
                method,
                f"{self._base}{path}",
                params=params,
                json=json_body,
                content=content,
                headers=self._headers("application/x-ndjson" if content is not None else "application/json"),
                timeout=self._s.pinecone_timeout_seconds,
            )
        except httpx.HTTPError as error:
            raise VectorError(f"Pinecone unreachable ({type(error).__name__})") from None
        if response.status_code >= 400:
            raise VectorError(f"Pinecone returned HTTP {response.status_code}")
        if not response.content:
            return {}
        try:
            body = response.json()
        except ValueError:
            raise VectorError("Pinecone returned a non-JSON response") from None
        return body if isinstance(body, dict) else {}

    # -- indexing -------------------------------------------------------------------

    def _record(self, chunk: Chunk) -> dict[str, str]:
        # Title and heading are part of what gets embedded: they carry most of a short passage's meaning.
        return {"_id": chunk.id, self._s.pinecone_text_field: f"{chunk.title}. {chunk.heading}. {chunk.text}", "doc_id": chunk.doc_id}

    async def _list_ids(self) -> set[str]:
        ids: set[str] = set()
        token: str | None = None
        for _ in range(MAX_LIST_PAGES):
            params: dict[str, str | int] = {"namespace": self._s.pinecone_namespace, "limit": LIST_PAGE}
            if token:
                params["paginationToken"] = token
            body = await self._call("GET", "/vectors/list", params=params)
            vectors = body.get("vectors")
            for item in vectors if isinstance(vectors, list) else []:
                if isinstance(item, dict) and isinstance(item.get("id"), str):
                    ids.add(item["id"])
            pagination = body.get("pagination")
            token = pagination.get("next") if isinstance(pagination, dict) else None
            if not isinstance(token, str) or not token:
                return ids
        raise VectorError("Pinecone listing did not end")

    async def sync(self, kb: KnowledgeBase) -> SyncReport:
        """Make the namespace hold exactly the knowledge base's chunks. Idempotent."""
        report = SyncReport(digest=kb.digest)
        try:
            records = [self._record(c) for c in kb.chunks]
            for start in range(0, len(records), UPSERT_BATCH):
                batch = records[start : start + UPSERT_BATCH]
                await self._call(
                    "POST",
                    f"/records/namespaces/{self._s.pinecone_namespace}/upsert",
                    content="\n".join(json.dumps(r, ensure_ascii=False) for r in batch),
                )
                report.upserted += len(batch)
            stale = sorted((await self._list_ids()) - {c.id for c in kb.chunks})
            for start in range(0, len(stale), DELETE_BATCH):
                batch_ids = stale[start : start + DELETE_BATCH]
                await self._call("POST", "/vectors/delete", json_body={"ids": batch_ids, "namespace": self._s.pinecone_namespace})
                report.deleted += len(batch_ids)
        except VectorError as error:
            self.status.synced_digest = None
            self.status.last_error = str(error)
            raise
        self.status.synced_digest = kb.digest
        self.status.last_error = None
        return report

    # -- search ---------------------------------------------------------------------

    async def search(self, query: str, kb: KnowledgeBase, limit: int) -> list[Hit]:
        """Vector hits for `query`, mapped onto the knowledge base's own chunks (unknown ids are dropped)."""
        if self.status.synced_digest != kb.digest:
            return []  # the index may not match this knowledge base yet: do not trust it
        body = await self._call(
            "POST",
            f"/records/namespaces/{self._s.pinecone_namespace}/search",
            json_body={"query": {"inputs": {"text": query}, "top_k": self._s.pinecone_top_k}, "fields": ["doc_id"]},
        )
        result = body.get("result")
        raw = result.get("hits") if isinstance(result, dict) else None
        by_id = {c.id: c for c in kb.chunks}
        hits: list[Hit] = []
        for item in raw if isinstance(raw, list) else []:
            if not isinstance(item, dict):
                continue
            chunk_id = item.get("_id")
            chunk = by_id.get(chunk_id) if isinstance(chunk_id, str) else None
            score = item.get("_score")
            if chunk is None or not isinstance(score, (int, float)) or isinstance(score, bool):
                continue
            if score >= self._s.pinecone_min_score:
                hits.append(Hit(chunk, float(score), 1.0))
        hits.sort(key=lambda h: (-h.score, h.chunk.id))
        return hits[:limit]


def fuse(lexical: list[Hit], vector: list[Hit], limit: int) -> list[Hit]:
    """Reciprocal rank fusion. A chunk found by both rankers rises; a chunk found by one still counts.

    The lexical list has already passed its coverage gate and the vector list its score floor, so a question that
    neither ranker finds relevant still ends with no hits (and the "not established" answer).
    """
    scores: dict[str, float] = {}
    chosen: dict[str, Hit] = {}
    for ranking in (lexical, vector):
        for rank, hit in enumerate(ranking):
            scores[hit.chunk.id] = scores.get(hit.chunk.id, 0.0) + 1.0 / (60 + rank + 1)
            # Prefer the lexical Hit (real coverage) when both exist.
            chosen.setdefault(hit.chunk.id, hit)
    order = sorted(scores, key=lambda cid: (-scores[cid], cid))
    return [chosen[cid] for cid in order[:limit]]


async def _check() -> None:  # python -m app.vector_store check|sync|search "question"
    import sys
    from pathlib import Path

    from app.config import load_settings

    settings = load_settings()
    if settings.pinecone_api_key is None:
        raise SystemExit("PINECONE_API_KEY / PINECONE_INDEX_HOST are not set")
    kb = KnowledgeBase.load(settings.knowledge_dir if isinstance(settings.knowledge_dir, Path) else Path(settings.knowledge_dir))
    async with httpx.AsyncClient() as http:
        store = PineconeStore(settings, http)
        action = sys.argv[1] if len(sys.argv) > 1 else "check"
        if action in ("check", "sync"):
            report = await store.sync(kb)
            print(f"synced: {report.upserted} upserted, {report.deleted} deleted, digest {report.digest[:12]}")
        if action in ("check", "search"):
            question = sys.argv[2] if len(sys.argv) > 2 else "How do I get a refund?"
            await store.sync(kb) if store.status.synced_digest is None else None
            for hit in await store.search(question, kb, 3):
                print(f"{hit.score:.3f}  {hit.chunk.id}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(_check())
