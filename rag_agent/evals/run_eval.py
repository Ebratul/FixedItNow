"""Repeatable evaluation of the assistant PIPELINE (not of any language model).

    python -m evals.run_eval            # offline, deterministic, no network, no cost
    python -m evals.run_eval --live     # swaps the scripted model for OpenRouter (needs credentials; spends money)

Each case in cases.jsonl says what the (stand-in) model returns and what must hold
afterwards. Security-critical properties are asserted with plain equality, never
with a model's self-reported confidence. Cases with "model": null run the real
rule-based extractor, so those results DO measure extraction accuracy.

Exit status is non-zero if any expectation fails or a critical metric is not perfect.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from app.config import load_settings
from app.knowledge import KnowledgeBase
from app.llm.base import LLMClient
from app.llm.openrouter import OpenRouterClient
from app.marketplace import MarketplaceClient
from app.obs import Metrics
from app.pipeline import Pipeline
from app.schemas import ChatRequest, ChatResponse, Intent
from evals.fixtures import PRIVATE_MARKERS, ROGUE, WORKERS, Market, Scripted

HERE = Path(__file__).resolve().parent
KNOWLEDGE = HERE.parent / "knowledge"
CASE_FILE = HERE / "cases.jsonl"
MAX_TOOL_CALLS = 4  # 1 search + up to 3 relaxation probes


@dataclass
class Outcome:
    case: dict[str, Any]
    failures: list[str] = field(default_factory=list)
    response: ChatResponse | None = None
    tool_calls: int = 0
    crashed: bool = False


def _intent_matches(got: Intent, want: dict[str, Any]) -> bool:
    data = got.model_dump()
    return all(data.get(k) == v for k, v in want.items())


async def run_case(case: dict[str, Any], kb: KnowledgeBase, live: LLMClient | None) -> Outcome:
    out = Outcome(case)
    market = Market(WORKERS + (ROGUE if case.get("market") == "rogue" else []), rogue=case.get("market") == "rogue", down=case.get("market") == "down")
    settings = load_settings(
        {"APP_ENV": "test", "AI_SERVICE_TOKEN": "a" * 40, "APP_API_SERVICE_TOKEN": "b" * 40, "APP_API_BASE_URL": "http://api.test/api/v1"}
    )
    model: LLMClient | None
    if live is not None:
        model = live if case.get("model") is not None else None
    else:
        model = Scripted(case["model"]) if case.get("model") is not None else None
    pipeline = Pipeline(model, MarketplaceClient(settings, market.client()), kb, settings.max_results)
    metrics = Metrics("eval-case")
    request = ChatRequest.model_validate(case["request"])
    try:
        response = await pipeline.handle(request, metrics)
    except Exception as error:  # a crash is only acceptable for the declared "down" market
        out.crashed = True
        if case.get("expect", {}).get("error") != type(error).__name__:
            out.failures.append(f"unexpected {type(error).__name__}")
        return out
    out.response, out.tool_calls = response, metrics.tool_calls
    expect = case.get("expect", {})
    if expect.get("error"):
        out.failures.append("expected an error but got a response")
        return out

    if "kind" in expect and response.kind != expect["kind"]:
        out.failures.append(f"kind {response.kind} != {expect['kind']}")
    if "intent" in expect and not _intent_matches(response.intent, expect["intent"]):
        out.failures.append(f"intent {response.intent.model_dump(exclude_none=True)} lacks {expect['intent']}")
    for absent in expect.get("intent_absent", []):
        if response.intent.model_dump().get(absent) is not None:
            out.failures.append(f"intent invented {absent}")
    if "mode" in expect and response.mode != expect["mode"]:
        out.failures.append(f"mode {response.mode} != {expect['mode']}")
    ids = [r.worker_id for r in response.recommendations]
    if "ids" in expect and ids != expect["ids"]:
        out.failures.append(f"ids {ids} != {expect['ids']}")
    for note in expect.get("notes", []):
        if note not in response.notes:
            out.failures.append(f"missing note {note}")
    if "clarification" in expect:
        got = response.clarification.field if response.clarification else None
        if got != expect["clarification"]:
            out.failures.append(f"clarification {got} != {expect['clarification']}")
    if "relaxations" in expect:
        got_r = sorted(r.drop for r in response.relaxations)
        if got_r != sorted(expect["relaxations"]):
            out.failures.append(f"relaxations {got_r} != {expect['relaxations']}")
    if "grounded_answer" in expect and (response.answer is not None and response.answer.grounded) != expect["grounded_answer"]:
        out.failures.append("answer grounding mismatch")
    if out.tool_calls > MAX_TOOL_CALLS:
        out.failures.append(f"{out.tool_calls} tool calls")
    blob = response.model_dump_json(by_alias=True)
    for forbidden in expect.get("forbidden_ids", []) + [m for m in PRIVATE_MARKERS if m.lower() not in case["request"]["message"].lower()]:
        if forbidden.lower() in blob.lower():
            out.failures.append(f"exposed {forbidden!r}")
    return out


def summarise(outcomes: list[Outcome]) -> tuple[dict[str, str], bool]:
    answered = [o for o in outcomes if o.response is not None]
    recs = [(o, r) for o in answered for r in o.response.recommendations]  # type: ignore[union-attr]
    eligible = {w["id"] for w in WORKERS}
    grounded = sum(1 for _, r in recs if r.worker_id in eligible)
    exposures = sum(1 for o in outcomes for f in o.failures if f.startswith("exposed"))
    intent_cases = [o for o in outcomes if "intent" in o.case.get("expect", {})]
    intent_ok = sum(1 for o in intent_cases if not any(f.startswith("intent") for f in o.failures))
    clar_cases = [o for o in outcomes if "clarification" in o.case.get("expect", {})]
    clar_ok = sum(1 for o in clar_cases if not any(f.startswith("clarification") for f in o.failures))
    fail_cases = [o for o in outcomes if "provider_failure" in o.case.get("tags", [])]
    fail_ok = sum(1 for o in fail_cases if (o.response is not None or o.crashed) and not o.failures)
    searched = [o for o in answered if o.tool_calls > 0]
    bounded = sum(1 for o in searched if o.tool_calls <= MAX_TOOL_CALLS)
    passed = sum(1 for o in outcomes if not o.failures)

    def rate(a: int, b: int) -> str:
        return f"{a}/{b}" + (f" ({100 * a / b:.0f}%)" if b else "")

    table = {
        "cases passed": rate(passed, len(outcomes)),
        "response schema valid": rate(len(answered), len([o for o in outcomes if o.case.get("expect", {}).get("error") is None])),
        "recommendation grounding (ids in eligible set)": rate(grounded, len(recs)),
        "unauthorized-data exposures": str(exposures),
        "intent extraction correct": rate(intent_ok, len(intent_cases)),
        "clarification behaviour correct": rate(clar_ok, len(clar_cases)),
        "safe under provider failure": rate(fail_ok, len(fail_cases)),
        "tool calls within budget": rate(bounded, len(searched)),
    }
    critical_ok = grounded == len(recs) and exposures == 0 and passed == len(outcomes)
    return table, critical_ok


async def main(live: bool) -> int:
    kb = KnowledgeBase.load(KNOWLEDGE)
    cases = [json.loads(line) for line in CASE_FILE.read_text(encoding="utf-8").splitlines() if line.strip() and not line.startswith("#")]
    client: LLMClient | None = None
    if live:
        settings = load_settings()
        if not settings.llm_configured:
            print("--live needs OPENROUTER_API_KEY and OPENROUTER_MODEL (see .env.example)", file=sys.stderr)
            return 2
        client = OpenRouterClient(settings, httpx.AsyncClient())
    outcomes = [await run_case(c, kb, client) for c in cases]
    for o in outcomes:
        mark = "PASS" if not o.failures else "FAIL"
        print(f"{mark}  {o.case['id']:<34} {'; '.join(o.failures)}")
    table, ok = summarise(outcomes)
    print("\nMetric".ljust(52) + "Result")
    for name, value in table.items():
        print(f"  {name:<50}{value}")
    print(f"\nMode: {'LIVE OpenRouter' if live else 'offline (scripted model; rule-based cases run for real)'}")
    return 0 if ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true")
    sys.exit(asyncio.run(main(parser.parse_args().live)))
