"""Typed contracts: the HTTP API of this service and the structured intent.

JSON uses camelCase (the main API's convention); Python uses snake_case.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

DIVISIONS = (
    "Dhaka",
    "Chattogram",
    "Rajshahi",
    "Khulna",
    "Barishal",
    "Sylhet",
    "Rangpur",
    "Mymensingh",
)
Division = Literal["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"]

MIN_BUDGET_BDT = 50
MAX_BUDGET_BDT = 1_000_000
MAX_MESSAGE_CHARS = 1000

SLUG_PATTERN = r"^[a-z0-9-]{1,50}$"

SortPreference = Literal["experience", "price_asc", "newest"]
FieldName = Literal["category", "location", "max_budget_bdt", "min_experience_years"]
Source = Literal["explicit", "inferred", "carried"]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Intent(ApiModel):
    """The searchable requirements. Also the conversation state: the client
    holds it between turns and sends it back, and it is re-validated every time."""

    category: str | None = Field(default=None, pattern=SLUG_PATTERN)
    location: Division | None = None
    max_budget_bdt: int | None = Field(default=None, ge=MIN_BUDGET_BDT, le=MAX_BUDGET_BDT)
    min_experience_years: int | None = Field(default=None, ge=0, le=60)
    sort: SortPreference | None = None
    # Free text kept only for display. Availability is not searchable.
    preferred_time: str | None = Field(default=None, max_length=80)
    problem: str | None = Field(default=None, max_length=200)

    def filter_fields(self) -> dict[str, object]:
        return {
            name: getattr(self, name)
            for name in ("category", "location", "max_budget_bdt", "min_experience_years")
            if getattr(self, name) is not None
        }


class ChatRequest(ApiModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    intent: Intent | None = None
    locale: Literal["auto", "en", "bn"] = "auto"
    # "search": the user changed filters in the UI (removed a chip, picked an option).
    # Re-runs the search for `intent` directly: no model call, no free-text reading.
    action: Literal["message", "search"] = "message"


class Option(ApiModel):
    value: str
    label: str


class Clarification(ApiModel):
    field: Literal["category", "location"]
    question: str
    options: list[Option] = Field(default_factory=list)
    # True: nothing can be searched until answered. False: results are shown anyway.
    blocking: bool


class MatchReason(ApiModel):
    code: Literal["CATEGORY", "LOCATION", "BUDGET", "EXPERIENCE"]


class Recommendation(ApiModel):
    """A *reference* to a worker the authoritative search returned. Facts (name,
    price, experience, ...) are never carried here; the main API re-reads them."""

    worker_id: str
    slug: str
    rank: int = Field(ge=1)
    matched_on: list[str]


class Relaxation(ApiModel):
    drop: FieldName
    match_count: int = Field(ge=1)


class SourceRef(ApiModel):
    id: str
    title: str
    url: str


class KnowledgeAnswer(ApiModel):
    text: str
    sources: list[SourceRef]
    # False when the knowledge base does not establish an answer.
    grounded: bool


Note = Literal[
    "AVAILABILITY_NOT_CHECKED",  # a time preference was given but search cannot filter by availability
    "BOOKING_NOT_SUPPORTED",  # the user asked the assistant to book/cancel/pay
    "INTENT_INFERRED",  # a filter was interpreted rather than stated
    "SIMPLE_MODE",  # the language model was not used (not configured or failed)
    "CONTACT_DETAILS_PRIVATE",
]

Kind = Literal["results", "no_results", "clarification", "answer", "out_of_scope", "refused"]


class ChatResponse(ApiModel):
    kind: Kind
    message: str
    language: Literal["en", "bn"]
    intent: Intent
    intent_sources: dict[str, Source] = Field(default_factory=dict)
    clarification: Clarification | None = None
    recommendations: list[Recommendation] = Field(default_factory=list)
    total: int | None = None
    relaxations: list[Relaxation] = Field(default_factory=list)
    answer: KnowledgeAnswer | None = None
    notes: list[Note] = Field(default_factory=list)
    # llm: model read the message. simple: rule-based fallback. direct: filters given, no reading needed.
    mode: Literal["llm", "simple", "direct"]


class ErrorBody(ApiModel):
    code: Literal[
        "INVALID_INPUT",
        "UNAUTHORIZED",
        "RATE_LIMITED",
        "MARKETPLACE_UNAVAILABLE",
        "BUSY",
        "INTERNAL",
    ]
    message: str
