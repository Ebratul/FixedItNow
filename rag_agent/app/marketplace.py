"""The ONLY way this service reads marketplace data: the main API's internal
AI endpoints, over HTTP, with a narrowly scoped service token.

There is no database access here. The caller passes a validated `SearchCriteria`
and every response is parsed into a strict model, so malformed or unexpected
data is dropped instead of being passed along.
"""

from __future__ import annotations

import time
from collections.abc import Sequence
from typing import Any, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import Settings
from app.schemas import MAX_BUDGET_BDT, MIN_BUDGET_BDT, SLUG_PATTERN, Division

CATEGORY_TTL_SECONDS = 300.0
MAX_PAGE_SIZE = 24


class MarketplaceError(Exception):
    """The main API could not answer. No upstream detail is kept."""


class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")

    slug: str = Field(pattern=SLUG_PATTERN)
    name: str = Field(max_length=100)
    description: str = Field(default="", max_length=300)


class CategoryRef(BaseModel):
    model_config = ConfigDict(extra="ignore")

    slug: str
    name: str


class KnowledgeDocument(BaseModel):
    """One published knowledge document as served by the main API. Validated again by KnowledgeBase."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=200)
    url: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=64 * 1024)


MAX_KNOWLEDGE_DOCUMENTS = 200


class WorkerCard(BaseModel):
    """Only the public fields the pipeline needs. `verification` must be exactly
    VERIFIED: a card that says anything else fails validation and is dropped."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=64)
    slug: str = Field(pattern=r"^[a-z0-9-]{1,100}$")
    categories: list[CategoryRef]
    service_areas: list[str] = Field(alias="serviceAreas")
    experience_years: int | None = Field(alias="experienceYears", default=None)
    starting_price_bdt: int | None = Field(alias="startingPriceBdt", default=None)
    verification: Literal["VERIFIED"]


class SearchCriteria(BaseModel):
    """Validated search arguments: the only shape the search tool accepts."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    category: str | None = Field(default=None, pattern=SLUG_PATTERN)
    location: Division | None = None
    max_price_bdt: int | None = Field(default=None, ge=MIN_BUDGET_BDT, le=MAX_BUDGET_BDT)
    min_experience_years: int | None = Field(default=None, ge=0, le=60)
    sort: Literal["newest", "experience", "price_asc"] = "experience"
    page_size: int = Field(default=5, ge=1, le=MAX_PAGE_SIZE)

    def query(self) -> dict[str, str]:
        params: dict[str, str] = {"sort": self.sort, "pageSize": str(self.page_size)}
        if self.category:
            params["category"] = self.category
        if self.location:
            params["location"] = self.location
        if self.max_price_bdt is not None:
            params["maxPrice"] = str(self.max_price_bdt)
        if self.min_experience_years is not None:
            params["minExperience"] = str(self.min_experience_years)
        return params


class SearchResult(BaseModel):
    workers: list[WorkerCard]
    total: int
    dropped: int = 0  # cards that failed validation


class MarketplaceClient:
    def __init__(self, settings: Settings, http: httpx.AsyncClient) -> None:
        self._base = settings.app_api_base_url
        self._token = settings.app_api_service_token
        self._http = http
        self._timeout = min(settings.request_timeout_seconds, 15.0)
        self._categories: tuple[float, list[Category]] | None = None

    async def _get(self, path: str, params: dict[str, str] | None = None) -> Any:
        try:
            response = await self._http.get(
                f"{self._base}/internal/ai/{path}",
                params=params,
                headers={"Authorization": f"Bearer {self._token.get_secret_value()}"},
                timeout=self._timeout,
            )
            if response.status_code != 200:
                raise MarketplaceError(f"status {response.status_code}")
            return response.json()
        except (httpx.HTTPError, ValueError):
            raise MarketplaceError("unreachable") from None

    async def categories(self) -> list[Category]:
        """Active categories. Non-personal, so a short cache is safe."""
        now = time.monotonic()
        if self._categories and now - self._categories[0] < CATEGORY_TTL_SECONDS:
            return self._categories[1]
        data = await self._get("categories")
        try:
            raw = data["categories"]
            parsed = [Category.model_validate(item) for item in raw]
        except (KeyError, TypeError, ValidationError):
            raise MarketplaceError("invalid categories payload") from None
        self._categories = (now, parsed)
        return parsed

    async def knowledge_documents(self) -> list[dict[str, str]]:
        """Published knowledge documents (admin-managed). Any malformed payload fails the whole fetch,
        so a half-valid set is never indexed."""
        data = await self._get("knowledge")
        try:
            raw = data["documents"]
            if not isinstance(raw, list) or len(raw) > MAX_KNOWLEDGE_DOCUMENTS:
                raise ValueError
            return [KnowledgeDocument.model_validate(item).model_dump() for item in raw]
        except (KeyError, TypeError, ValueError, ValidationError):
            raise MarketplaceError("invalid knowledge payload") from None

    async def search_workers(self, criteria: SearchCriteria) -> SearchResult:
        data = await self._get("workers", criteria.query())
        try:
            raw_workers: Sequence[Any] = data["workers"]
            total = int(data["total"])
        except (KeyError, TypeError, ValueError):
            raise MarketplaceError("invalid search payload") from None
        workers: list[WorkerCard] = []
        dropped = 0
        for item in raw_workers[: criteria.page_size]:
            try:
                workers.append(WorkerCard.model_validate(item))
            except ValidationError:
                dropped += 1
        return SearchResult(workers=workers, total=max(total, len(workers)), dropped=dropped)
