"""The request pipeline: a small, fixed sequence with one decision point.

    screen -> catalogue -> extract intent -> merge -> route
        route: platform question -> retrieve -> answer
               no service yet     -> clarify
               otherwise          -> search (tool) -> verify -> respond

Why not LangGraph: there are no loops and no model-chosen branches. The model
never selects tools, arguments or worker ids; code does. A graph runtime would
add a dependency and indirection without adding capability (see docs/AI.md).
The tool-call budget is a constant: 1 search + at most 3 relaxation probes.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass

from app import heuristics, messages
from app.extraction import (
    Extraction,
    GeneratedAnswer,
    extract_intent,
    generate_answer,
)
from app.knowledge import Hit, KnowledgeBase
from app.llm.base import LLMClient, LLMError
from app.marketplace import Category, MarketplaceClient, SearchCriteria, WorkerCard
from app.messages import Lang
from app.obs import Metrics
from app.safety import screen
from app.schemas import (
    DIVISIONS,
    ChatRequest,
    ChatResponse,
    Clarification,
    FieldName,
    Intent,
    KnowledgeAnswer,
    Note,
    Option,
    Recommendation,
    Relaxation,
    Source,
    SourceRef,
)
from app.text import detect_language, normalize
from app.vector_store import PineconeStore, VectorError, fuse

RELAXABLE: tuple[FieldName, ...] = ("max_budget_bdt", "min_experience_years", "location")
_POLICY_WORDS = re.compile(
    r"\b(cancel\w*|refund\w*|pay\w*|polic\w+|dispute\w*|resched\w*|fees?|quotes?|verif\w+|onboard\w*|how (do|does|can|to)|"
    r"what (is|happens)|join|reviewed|safe|safety)\b|কিভাবে|কীভাবে|নিয়ম|রিফান্ড|পেমেন্ট",
    re.IGNORECASE,
)


@dataclass
class Pipeline:
    llm: LLMClient | None
    marketplace: MarketplaceClient
    knowledge: KnowledgeBase
    max_results: int = 5
    vectors: PineconeStore | None = None

    async def handle(self, request: ChatRequest, metrics: Metrics) -> ChatResponse:
        text = normalize(request.message)
        lang: Lang = request.locale if request.locale != "auto" else detect_language(text)  # type: ignore[assignment]
        prior = request.intent or Intent()
        if request.action == "search":
            return await self._direct_search(prior, lang, metrics)
        flags = screen(text)
        metrics.screen_flags = flags.flags()

        if flags.refuse:
            reason = "contact" if flags.private_data else "other"
            notes: list[Note] = ["CONTACT_DETAILS_PRIVATE"] if flags.private_data else []
            return self._respond("refused", messages.refused(lang, reason), lang, prior, metrics, notes=notes)

        categories = await self.marketplace.categories()
        slugs = {c.slug for c in categories}
        extraction = await self._extract(text, prior, categories, slugs, metrics)

        intent, sources = merge(prior, extraction)
        notes = []
        if flags.action_request:
            notes.append("BOOKING_NOT_SUPPORTED")

        if extraction.request_type == "platform_question":
            return await self._answer(text, extraction, lang, prior, metrics, notes)
        if extraction.request_type == "out_of_scope":
            return self._respond("out_of_scope", messages.out_of_scope(lang), lang, prior, metrics, notes=notes)

        if intent.category is None:
            blocking = Clarification(
                field="category",
                question=messages.ask_category(lang),
                options=[Option(value=c.slug, label=c.name) for c in categories],
                blocking=True,
            )
            text_out = messages.unclear(lang) if extraction.request_type == "unclear" and not sources else blocking.question
            return self._respond("clarification", text_out, lang, intent, metrics, sources, blocking, notes=notes)

        return await self._search(intent, sources, categories, lang, metrics, notes)

    async def _direct_search(self, intent: Intent, lang: Lang, metrics: Metrics) -> ChatResponse:
        """Filters were edited in the UI: search again without reading any free text."""
        metrics.mode = "direct"
        categories = await self.marketplace.categories()
        sources: dict[str, Source] = {k: "explicit" for k in intent.filter_fields()}
        if intent.category is None or intent.category not in {c.slug for c in categories}:
            question = Clarification(
                field="category",
                question=messages.ask_category(lang),
                options=[Option(value=c.slug, label=c.name) for c in categories],
                blocking=True,
            )
            cleared = intent.model_copy(update={"category": None})
            return self._respond("clarification", question.question, lang, cleared, metrics, sources, question)
        return await self._search(intent, sources, categories, lang, metrics, [])

    # -- extraction -----------------------------------------------------------------

    async def _extract(
        self, text: str, prior: Intent, categories: list[Category], slugs: set[str], metrics: Metrics
    ) -> Extraction:
        if self.llm is not None:
            try:
                extraction = await extract_intent(
                    self.llm, metrics, message=text, current=prior.filter_fields(), categories=categories
                )
                metrics.mode = "llm"
                return extraction
            except LLMError:
                pass  # category recorded in metrics; fall through to simple mode
        return self._heuristic_extraction(text, prior, slugs, metrics)

    def _heuristic_extraction(self, text: str, prior: Intent, slugs: set[str], metrics: Metrics) -> Extraction:
        delta = heuristics.extract(text, slugs)
        if _POLICY_WORDS.search(text) and self.knowledge.search(text):
            return Extraction("platform_question", "en", {}, set(), text)
        has_filters = any(k in delta for k in ("category", "location", "max_budget_bdt", "min_experience_years"))
        if delta.get("category") or (has_filters and prior.category):
            return Extraction("find_worker", "en", delta)
        return Extraction("unclear", "en", delta)

    # -- search ---------------------------------------------------------------------

    async def _search(
        self,
        intent: Intent,
        sources: dict[str, Source],
        categories: list[Category],
        lang: Lang,
        metrics: Metrics,
        notes: list[Note],
    ) -> ChatResponse:
        sort = intent.sort or "experience"
        base = SearchCriteria(
            category=intent.category,
            location=intent.location,
            max_price_bdt=intent.max_budget_bdt,
            min_experience_years=intent.min_experience_years,
            sort=sort,
            page_size=self.max_results,
        )
        metrics.tool_calls += 1
        try:
            result = await self.marketplace.search_workers(base)
        except Exception:
            metrics.tool_failures += 1
            raise
        kept = [w for w in result.workers if _satisfies(w, intent)]
        metrics.validation_failures += result.dropped + (len(result.workers) - len(kept))
        total = result.total
        if len(kept) < len(result.workers):
            total = max(len(kept), total - (len(result.workers) - len(kept)))

        if intent.preferred_time:
            notes.append("AVAILABILITY_NOT_CHECKED")
        if any(v == "inferred" for v in sources.values()):
            notes.append("INTENT_INFERRED")
        if metrics.mode == "simple":
            notes.append("SIMPLE_MODE")

        if not kept:
            relaxations = await self._relaxations(intent, base, metrics)
            return self._respond(
                "no_results", messages.no_results(lang, bool(relaxations)), lang, intent, metrics, sources,
                relaxations=relaxations, total=0, notes=notes,
            )

        recs = [
            Recommendation(
                worker_id=w.id,
                slug=w.slug,
                rank=i,
                matched_on=_matched_on(intent),
            )
            for i, w in enumerate(kept, start=1)
        ]
        followup = None
        if intent.location is None and total > len(kept):
            followup = Clarification(
                field="location",
                question=messages.ask_location(lang),
                options=[Option(value=d, label=d) for d in DIVISIONS],
                blocking=False,
            )
        return self._respond(
            "results", messages.results(lang, len(recs), total, sort), lang, intent, metrics, sources, followup,
            recommendations=recs, total=total, notes=notes,
        )

    async def _relaxations(self, intent: Intent, base: SearchCriteria, metrics: Metrics) -> list[Relaxation]:
        out: list[Relaxation] = []
        for field in RELAXABLE:
            if getattr(intent, field) is None:
                continue
            probe = base.model_copy(
                update={
                    {"max_budget_bdt": "max_price_bdt"}.get(field, field): None,
                    "page_size": 1,
                }
            )
            metrics.tool_calls += 1
            try:
                result = await self.marketplace.search_workers(probe)
            except Exception:
                metrics.tool_failures += 1
                continue
            if result.total >= 1:
                out.append(Relaxation(drop=field, match_count=result.total))
        return out

    # -- knowledge ------------------------------------------------------------------

    async def _answer(
        self, text: str, extraction: Extraction, lang: Lang, prior: Intent, metrics: Metrics, notes: list[Note]
    ) -> ChatResponse:
        query = extraction.knowledge_query or text
        started = time.perf_counter()
        hits = await self._retrieve(query, metrics)
        metrics.retrieval_ms += (time.perf_counter() - started) * 1000
        if not hits:
            return self._unanswered(lang, prior, metrics, notes)

        chosen: GeneratedAnswer | None = None
        if self.llm is not None and metrics.mode == "llm":
            try:
                generated = await generate_answer(self.llm, metrics, question=text, hits=hits, language=lang)
            except LLMError:
                generated = "invalid"
            if generated == "unanswerable":
                return self._unanswered(lang, prior, metrics, notes)
            if isinstance(generated, GeneratedAnswer):
                chosen = generated
        if chosen is None:
            chosen = _extractive(hits)

        by_id = {h.chunk.id: h.chunk for h in hits}
        refs = [SourceRef(id=i, title=by_id[i].title, url=by_id[i].url) for i in chosen.source_ids]
        answer = KnowledgeAnswer(text=chosen.text, sources=refs, grounded=True)
        if metrics.mode == "simple":
            notes.append("SIMPLE_MODE")
        return self._respond("answer", chosen.text, lang, prior, metrics, notes=notes, answer=answer)

    async def _retrieve(self, query: str, metrics: Metrics) -> list[Hit]:
        """Lexical ranking always; fused with Pinecone's vector ranking when it is configured and in sync.
        Any Pinecone problem falls back to lexical alone: the answer is never blocked by the cloud index."""
        lexical = self.knowledge.search(query)
        metrics.retrieval = "lexical"
        if self.vectors is None:
            return lexical
        try:
            vector = await self.vectors.search(query, self.knowledge, limit=3)
        except VectorError:
            metrics.retrieval = "lexical_fallback"
            return lexical
        if self.vectors.status.synced_digest != self.knowledge.digest:
            metrics.retrieval = "lexical_fallback"  # not synced for this knowledge version
            return lexical
        metrics.retrieval = "hybrid"
        return fuse(lexical, vector, limit=3)

    def _unanswered(self, lang: Lang, prior: Intent, metrics: Metrics, notes: list[Note]) -> ChatResponse:
        text = messages.not_established(lang)
        answer = KnowledgeAnswer(text=text, sources=[], grounded=False)
        return self._respond("answer", text, lang, prior, metrics, notes=notes, answer=answer)

    # -- response -------------------------------------------------------------------

    def _respond(
        self,
        kind: str,
        message: str,
        lang: Lang,
        intent: Intent,
        metrics: Metrics,
        sources: dict[str, Source] | None = None,
        clarification: Clarification | None = None,
        *,
        recommendations: list[Recommendation] | None = None,
        total: int | None = None,
        relaxations: list[Relaxation] | None = None,
        answer: KnowledgeAnswer | None = None,
        notes: list[Note] | None = None,
    ) -> ChatResponse:
        metrics.kind = kind
        return ChatResponse.model_validate(
            {
                "kind": kind,
                "message": message,
                "language": lang,
                "intent": intent,
                "intent_sources": sources or {},
                "clarification": clarification,
                "recommendations": recommendations or [],
                "total": total,
                "relaxations": relaxations or [],
                "answer": answer,
                "notes": list(dict.fromkeys(notes or [])),
                "mode": metrics.mode,
            }
        )


def merge(prior: Intent, extraction: Extraction) -> tuple[Intent, dict[str, Source]]:
    """New message values override carried ones; nothing is ever cleared by omission."""
    values = prior.model_dump()
    sources: dict[str, Source] = {k: "carried" for k in prior.filter_fields()}
    for key, value in extraction.delta.items():
        values[key] = value
        if key in ("category", "location", "max_budget_bdt", "min_experience_years"):
            sources[key] = "inferred" if key in extraction.inferred else "explicit"
    return Intent.model_validate(values), sources


def _satisfies(worker: WorkerCard, intent: Intent) -> bool:
    """Re-check the mandatory filters locally. The backend already applied them;
    this makes grounding independent of the backend being correct."""
    if intent.category and intent.category not in {c.slug for c in worker.categories}:
        return False
    if intent.location and intent.location not in worker.service_areas:
        return False
    if intent.max_budget_bdt is not None and (
        worker.starting_price_bdt is None or worker.starting_price_bdt > intent.max_budget_bdt
    ):
        return False
    return not (
        intent.min_experience_years is not None
        and (worker.experience_years is None or worker.experience_years < intent.min_experience_years)
    )


def _matched_on(intent: Intent) -> list[str]:
    codes = ["CATEGORY"]
    if intent.location:
        codes.append("LOCATION")
    if intent.max_budget_bdt is not None:
        codes.append("BUDGET")
    if intent.min_experience_years is not None:
        codes.append("EXPERIENCE")
    return codes


def _extractive(hits: list[Hit]) -> GeneratedAnswer:
    """Used without a model (or when its output is rejected): quote the best passage."""
    best = hits[0].chunk
    sentences = re.split(r"(?<=[.!?])\s+", best.text.replace("\n", " "))
    text = ""
    for sentence in sentences:
        if len(text) + len(sentence) > 450 and text:
            break
        text = f"{text} {sentence}".strip()
    ids = [best.id] + [h.chunk.id for h in hits[1:2] if h.chunk.doc_id != best.doc_id]
    return GeneratedAnswer(text, ids)
