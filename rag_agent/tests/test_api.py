"""HTTP surface: service authentication, validation, limits, error shapes, logging."""

from __future__ import annotations

import json
import logging

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.support import AI_TOKEN, FakeMarketplace, ScriptedLLM, extraction, make_settings, worker

AUTH = {"Authorization": f"Bearer {AI_TOKEN}"}


def build(llm=None, market=None, **env):
    market = market or FakeMarketplace([worker("w1"), worker("w2", years=2)])
    app = create_app(make_settings(**env), llm=llm, http=market.client())
    return TestClient(app, raise_server_exceptions=False), market


def chat(client: TestClient, message="plumber in Sylhet", headers=AUTH, **extra):
    return client.post("/v1/chat", json={"message": message, **extra}, headers=headers)


def test_health_is_public_and_leaks_nothing():
    with build()[0] as client:
        body = client.get("/health").json()
    assert body == {"status": "ok", "llm": "not_configured", "knowledgeChunks": body["knowledgeChunks"]}
    assert AI_TOKEN not in json.dumps(body)


@pytest.mark.parametrize("header", [{}, {"Authorization": "Bearer wrong"}, {"Authorization": AI_TOKEN}, {"Authorization": "Bearer "}, {"Authorization": f"Basic {AI_TOKEN}"}])
def test_chat_requires_the_service_token(header):
    client, market = build()
    with client:
        response = chat(client, headers=header)
    assert response.status_code == 401 and response.json()["code"] == "UNAUTHORIZED"
    assert market.requests == []


def test_successful_chat_uses_camel_case_and_only_references():
    client, _ = build(ScriptedLLM(extraction(category="plumbing", location="Sylhet")))
    with client:
        response = chat(client)
    body = response.json()
    assert response.status_code == 200 and body["kind"] == "results" and body["mode"] == "llm"
    first = body["recommendations"][0]
    assert set(first) == {"workerId", "slug", "rank", "matchedOn"}  # no facts, no names, no prices
    assert body["intentSources"] == {"category": "explicit", "location": "explicit"}


@pytest.mark.parametrize(
    "payload",
    [{}, {"message": ""}, {"message": "x" * 1001}, {"message": "hi", "extra": 1}, {"message": "hi", "intent": {"userId": "1"}},
     {"message": "hi", "intent": {"location": "Mars"}}, {"message": "hi", "intent": {"category": "a b"}},
     {"message": "hi", "intent": {"maxBudgetBdt": 5}}, {"message": "hi", "locale": "fr"}, {"message": 5}],
)
def test_invalid_input_is_rejected_without_echoing_it(payload):
    client, _ = build()
    with client:
        response = client.post("/v1/chat", json=payload, headers=AUTH)
    assert response.status_code == 400 and response.json()["code"] == "INVALID_INPUT"
    assert "Mars" not in response.text and "xxxx" not in response.text


def test_oversized_body_is_refused():
    client, _ = build()
    with client:
        response = client.post("/v1/chat", content=b"{" + b" " * 20_000 + b"}", headers={**AUTH, "content-type": "application/json"})
    assert response.status_code in (400, 413)


def test_per_subject_rate_limit_isolates_users():
    client, _ = build(AI_RATE_LIMIT_PER_MINUTE="2")
    with client:
        codes_a = [chat(client, headers={**AUTH, "X-Subject": "user-a"}).status_code for _ in range(3)]
        code_b = chat(client, headers={**AUTH, "X-Subject": "user-b"}).status_code
    assert codes_a == [200, 200, 429] and code_b == 200


def test_marketplace_outage_is_a_503_not_a_made_up_answer():
    client, _ = build(market=FakeMarketplace([worker("w1")], down=True))
    with client:
        response = chat(client)
    assert response.status_code == 503 and response.json()["code"] == "MARKETPLACE_UNAVAILABLE"


def test_unexpected_errors_do_not_leak_details(monkeypatch):
    client, _ = build()
    with client:
        monkeypatch.setattr("app.pipeline.Pipeline.handle", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("secret detail /etc/x")))
        response = chat(client)
    assert response.status_code == 500 and response.json() == {"code": "INTERNAL", "message": "The assistant hit an internal error."}


def test_docs_are_not_exposed_outside_development():
    client, _ = build()
    with client:
        assert client.get("/docs").status_code == 404 and client.get("/openapi.json").status_code == 404


def test_logs_have_metadata_but_never_message_text_or_secrets(caplog: pytest.LogCaptureFixture):
    caplog.set_level(logging.INFO, logger="fixeditnow.ai")
    private = "my secret address is 12 Zindabazar and my plumber is Karim"
    client, _ = build(ScriptedLLM(extraction(category="plumbing", problem="private problem text")))
    with client:
        chat(client, message=private, headers={**AUTH, "X-Correlation-Id": "corr-1234567890", "X-Subject": "user-1"})
    text = "\n".join(r.getMessage() for r in caplog.records)
    record = json.loads(next(r.getMessage() for r in caplog.records if '"ai_chat"' in r.getMessage()))
    assert record["correlationId"] == "corr-1234567890" and record["kind"] == "results" and record["toolCalls"] == 1
    assert record["model"] == "scripted-model" and record["promptTokens"] == 100
    for forbidden in (private, "Zindabazar", "Karim", "private problem text", AI_TOKEN, "user-1", "worker-w1"):
        assert forbidden not in text
