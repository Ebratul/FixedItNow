"""Deterministic fixtures for the evaluation: a small marketplace and a scripted model."""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.llm.base import LLMError, LLMErrorCategory, LLMResult

CATEGORIES = [
    {"slug": "electrical", "name": "Electrical Services", "description": "Wiring, switches, fans, lighting."},
    {"slug": "plumbing", "name": "Plumbing", "description": "Leaks, taps, pipes, drainage."},
    {"slug": "ac-repair", "name": "AC Repair & Servicing", "description": "Air conditioner servicing."},
    {"slug": "appliance-repair", "name": "Appliance Repair", "description": "Fridges, washing machines."},
    {"slug": "home-cleaning", "name": "Home Cleaning", "description": "Deep cleaning."},
]
NAMES = {c["slug"]: c["name"] for c in CATEGORIES}


def _worker(
    wid: str, category: str, areas: list[str], price: int | None, years: int | None, verification: str = "VERIFIED"
) -> dict[str, Any]:
    return {
        "id": wid, "slug": f"w-{wid}", "displayName": f"Worker {wid}", "headline": None,
        "primaryCategory": {"slug": category, "name": NAMES[category]},
        "categories": [{"slug": category, "name": NAMES[category]}],
        "serviceAreas": areas, "experienceYears": years, "startingPriceBdt": price,
        "verification": verification, "rating": None, "reviewCount": 0, "publishedAt": "2026-10-01T00:00:00Z",
    }


# ELIGIBLE workers only: the real API never returns anything else.
WORKERS = [
    _worker("p1", "plumbing", ["Sylhet"], 700, 10),
    _worker("p2", "plumbing", ["Sylhet", "Dhaka"], 1200, 4),
    _worker("p3", "plumbing", ["Dhaka"], 2500, 7),
    _worker("e1", "electrical", ["Sylhet"], 500, 6),
    _worker("e2", "electrical", ["Dhaka"], 900, 12),
    _worker("a1", "ac-repair", ["Dhaka", "Chattogram"], 1500, 8),
    _worker("r1", "appliance-repair", ["Dhaka"], 800, 3),
]
# What a broken or hostile backend might additionally return. Never legitimate.
ROGUE = [
    _worker("x-unverified", "plumbing", ["Sylhet"], 100, 30, verification="PENDING"),
    _worker("x-wrong-area", "plumbing", ["Rangpur"], 100, 30),
    _worker("x-no-price", "plumbing", ["Sylhet"], None, 30),
]
PRIVATE_MARKERS = ["@example.com", "017", "password", "api key", "system prompt", "DROP TABLE"]


class Market:
    def __init__(self, workers: list[dict[str, Any]], *, rogue: bool = False, down: bool = False) -> None:
        self.workers, self.rogue, self.down = workers, rogue, down
        self.search_calls = 0

    def _handle(self, request: httpx.Request) -> httpx.Response:
        if self.down:
            return httpx.Response(503, json={})
        path, q = request.url.path, dict(request.url.params)
        if path.endswith("/categories"):
            return httpx.Response(200, json={"categories": CATEGORIES})
        self.search_calls += 1
        rows = list(self.workers)
        if not self.rogue:
            if "category" in q:
                rows = [w for w in rows if w["primaryCategory"]["slug"] == q["category"]]
            if "location" in q:
                rows = [w for w in rows if q["location"] in w["serviceAreas"]]
            if "maxPrice" in q:
                rows = [w for w in rows if w["startingPriceBdt"] is not None and w["startingPriceBdt"] <= int(q["maxPrice"])]
            if "minExperience" in q:
                rows = [w for w in rows if (w["experienceYears"] or -1) >= int(q["minExperience"])]
        key = (lambda w: (w["startingPriceBdt"] is None, w["startingPriceBdt"] or 0)) if q.get("sort") == "price_asc" else (lambda w: -(w["experienceYears"] or -1))
        rows.sort(key=key)
        size = int(q.get("pageSize", 12))
        return httpx.Response(200, json={"workers": rows[:size], "total": len(rows)})

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self._handle))


class Scripted:
    """Plays back what the case says the model returns: JSON, raw text, or a provider error."""

    provider = "scripted"
    model = "scripted"

    def __init__(self, replies: list[Any]) -> None:
        self.replies = list(replies)
        self.calls = 0

    async def complete_json(self, *, system: str, user: str, schema_name: str, schema: dict[str, Any], max_tokens: int) -> LLMResult:
        self.calls += 1
        if not self.replies:
            raise LLMError("provider_error")
        reply = self.replies.pop(0)
        if isinstance(reply, dict) and "error" in reply:
            category: LLMErrorCategory = reply["error"]
            raise LLMError(category)
        content = reply if isinstance(reply, str) else json.dumps(reply)
        return LLMResult(content=content, model="scripted", prompt_tokens=1, completion_tokens=1)
