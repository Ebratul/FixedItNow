from __future__ import annotations

import json

import httpx
import pytest

from app.llm.base import LLMError
from app.llm.openrouter import OpenRouterClient
from tests.support import make_settings

KEY = "sk-or-v1-" + "k" * 40


def client(handler, **env) -> OpenRouterClient:
    settings = make_settings(OPENROUTER_API_KEY=KEY, OPENROUTER_MODEL="vendor/some-model", **env)
    return OpenRouterClient(settings, httpx.AsyncClient(transport=httpx.MockTransport(handler)))


async def call(c: OpenRouterClient):
    return await c.complete_json(system="s", user="u", schema_name="x", schema={"type": "object"}, max_tokens=50)


def ok(content="{}", **extra):
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}], "model": "vendor/some-model", **extra})


async def test_request_follows_the_documented_contract():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"], seen["headers"], seen["body"] = str(request.url), request.headers, json.loads(request.content)
        return ok('{"a":1}', usage={"prompt_tokens": 11, "completion_tokens": 3})

    result = await call(client(handler))
    assert seen["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert seen["headers"]["authorization"] == f"Bearer {KEY}"
    body = seen["body"]
    assert body["model"] == "vendor/some-model" and body["max_tokens"] == 50 and body["temperature"] == 0
    assert body["response_format"]["type"] == "json_schema" and body["response_format"]["json_schema"]["strict"] is True
    assert body["provider"] == {"require_parameters": True}
    assert [m["role"] for m in body["messages"]] == ["system", "user"]
    assert (result.content, result.prompt_tokens, result.completion_tokens) == ('{"a":1}', 11, 3)


async def test_response_format_is_configurable():
    bodies = []

    def handler(request):
        bodies.append(json.loads(request.content))
        return ok()

    await call(client(handler, OPENROUTER_RESPONSE_FORMAT="none"))
    await call(client(handler, OPENROUTER_RESPONSE_FORMAT="json_object"))
    assert "response_format" not in bodies[0] and "provider" not in bodies[0]
    assert bodies[1]["response_format"] == {"type": "json_object"}


@pytest.mark.parametrize(
    ("status", "category"),
    [(401, "auth"), (403, "auth"), (402, "insufficient_credits"), (408, "timeout"), (429, "rate_limited"),
     (400, "unsupported_feature"), (502, "provider_error"), (503, "provider_error"), (500, "provider_error")],
)
async def test_http_errors_map_to_categories(status, category):
    secret_echo = f"prompt text and {KEY}"
    c = client(lambda r: httpx.Response(status, json={"error": {"code": status, "message": secret_echo}}))
    with pytest.raises(LLMError) as err:
        await call(c)
    assert err.value.category == category and err.value.status == status
    assert KEY not in repr(err.value) and "prompt text" not in str(err.value)


async def test_error_inside_a_200_response_is_detected():
    c = client(lambda r: httpx.Response(200, json={"error": {"code": 429, "message": "slow down"}}))
    with pytest.raises(LLMError) as err:
        await call(c)
    assert err.value.category == "rate_limited"


async def test_timeout_and_network_errors():
    def slow(request):
        raise httpx.ReadTimeout("took too long", request=request)

    def broken(request):
        raise httpx.ConnectError(f"cannot connect {KEY}", request=request)

    with pytest.raises(LLMError) as t:
        await call(client(slow))
    assert t.value.category == "timeout"
    with pytest.raises(LLMError) as n:
        await call(client(broken))
    assert n.value.category == "provider_error" and n.value.__cause__ is None and KEY not in str(n.value)


@pytest.mark.parametrize(
    ("response", "category"),
    [
        (httpx.Response(200, text="<html>"), "malformed_response"),
        (httpx.Response(200, json=[1, 2]), "malformed_response"),
        (httpx.Response(200, json={"choices": []}), "malformed_response"),
        (httpx.Response(200, json={"choices": [{"message": {"content": None}}]}), "empty_response"),
        (httpx.Response(200, json={"choices": [{"message": {"content": "   "}}]}), "empty_response"),
        (httpx.Response(200, json={"choices": [{"message": {"content": "x" * 25_000}}]}), "malformed_response"),
    ],
)
async def test_unusable_bodies(response, category):
    with pytest.raises(LLMError) as err:
        await call(client(lambda r: response))
    assert err.value.category == category


def test_unconfigured_client_cannot_be_built():
    with pytest.raises(LLMError) as err:
        OpenRouterClient(make_settings(), httpx.AsyncClient())
    assert err.value.category == "not_configured"
