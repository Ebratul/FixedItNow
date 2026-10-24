"""Test doubles: a scripted language model and an in-memory marketplace API."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx

from app.config import Settings, load_settings
from app.extraction import ANSWER_SCHEMA, EXTRACTION_SCHEMA
from app.llm.base import LLMError, LLMResult

AI_TOKEN = "a" * 40
APP_TOKEN = "b" * 40
KNOWLEDGE = Path(__file__).resolve().parent.parent / "knowledge"

CATEGORIES = [
    {"slug": "electrical", "name": "Electrical Services", "description": "Wiring, switches, fans, lighting."},
    {"slug": "plumbing", "name": "Plumbing", "description": "Leaks, taps, pipes, drainage."},
    {"slug": "ac-repair", "name": "AC Repair & Servicing", "description": "Air conditioner servicing."},
    {"slug": "appliance-repair", "name": "Appliance Repair", "description": "Fridges, washing machines."},
]


def make_settings(**overrides: str) -> Settings:
    env = {
        "APP_ENV": "test",
        "AI_SERVICE_TOKEN": AI_TOKEN,
        "APP_API_SERVICE_TOKEN": APP_TOKEN,
        "APP_API_BASE_URL": "http://api.test/api/v1",
        "AI_KNOWLEDGE_DIR": str(KNOWLEDGE),
        **overrides,
    }
    return load_settings(env)


def worker(
    wid: str,
    *,
    category: str = "plumbing",
    areas: tuple[str, ...] = ("Sylhet",),
    price: int | None = 800,
    years: int | None = 5,
    verification: str = "VERIFIED",
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    names = {c["slug"]: c["name"] for c in CATEGORIES}
    card = {
        "id": wid,
        "slug": f"worker-{wid}",
        "displayName": f"Worker {wid}",
        "headline": None,
        "primaryCategory": {"slug": category, "name": names[category]},
        "categories": [{"slug": category, "name": names[category]}],
        "serviceAreas": list(areas),
        "experienceYears": years,
        "startingPriceBdt": price,
        "verification": verification,
        "rating": None,
        "reviewCount": 0,
        "publishedAt": "2026-10-01T00:00:00.000Z",
    }
    card.update(extra or {})
    return card


class FakeMarketplace:
    """Mimics GET /internal/ai/{categories,workers}. `rogue=True` makes the
    'backend' ignore filters, to prove the pipeline re-verifies results."""

    def __init__(self, workers: list[dict[str, Any]], *, rogue: bool = False, down: bool = False) -> None:
        self.workers = workers
        self.rogue = rogue
        self.down = down
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.headers.get("authorization") != f"Bearer {APP_TOKEN}":
            return httpx.Response(401, json={"message": "no"})
        if self.down:
            return httpx.Response(503, json={"message": "down"})
        path = request.url.path
        if path.endswith("/internal/ai/categories"):
            return httpx.Response(200, json={"categories": CATEGORIES})
        if path.endswith("/internal/ai/workers"):
            q = dict(request.url.params)
            rows = list(self.workers)
            if not self.rogue:
                if "category" in q:
                    rows = [w for w in rows if any(c["slug"] == q["category"] for c in w["categories"])]
                if "location" in q:
                    rows = [w for w in rows if q["location"] in w["serviceAreas"]]
                if "maxPrice" in q:
                    rows = [w for w in rows if w["startingPriceBdt"] is not None and w["startingPriceBdt"] <= int(q["maxPrice"])]
                if "minExperience" in q:
                    rows = [w for w in rows if w["experienceYears"] is not None and w["experienceYears"] >= int(q["minExperience"])]
            if q.get("sort") == "price_asc":
                rows.sort(key=lambda w: (w["startingPriceBdt"] is None, w["startingPriceBdt"] or 0))
            else:
                rows.sort(key=lambda w: -(w["experienceYears"] or -1))
            size = int(q.get("pageSize", 12))
            return httpx.Response(200, json={"workers": rows[:size], "total": len(rows), "page": 1, "pageSize": size})
        return httpx.Response(404, json={})

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handler))

    def worker_searches(self) -> list[httpx.Request]:
        return [r for r in self.requests if r.url.path.endswith("/workers")]


class ScriptedLLM:
    """Replies with queued items. A str is the model's raw content; an LLMError is raised."""

    provider = "scripted"
    model = "scripted-model"

    def __init__(self, *replies: str | dict[str, Any] | LLMError) -> None:
        self.replies = list(replies)
        self.calls: list[dict[str, Any]] = []

    async def complete_json(self, *, system: str, user: str, schema_name: str, schema: dict[str, Any], max_tokens: int) -> LLMResult:
        self.calls.append({"system": system, "user": user, "schema_name": schema_name, "schema": schema, "max_tokens": max_tokens})
        if not self.replies:
            raise AssertionError("unexpected extra model call")
        reply = self.replies.pop(0)
        if isinstance(reply, LLMError):
            raise reply
        content = reply if isinstance(reply, str) else json.dumps(reply)
        return LLMResult(content=content, model=self.model, prompt_tokens=100, completion_tokens=20)


def extraction(request_type: str = "find_worker", **fields: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "request_type": request_type,
        "language": "en",
        "category": None,
        "location": None,
        "max_budget_bdt": None,
        "min_experience_years": None,
        "sort": None,
        "preferred_time": None,
        "problem": None,
        "knowledge_query": None,
        "inferred_fields": [],
    }
    base.update(fields)
    return base


Handler = Callable[[httpx.Request], httpx.Response]
assert EXTRACTION_SCHEMA and ANSWER_SCHEMA
