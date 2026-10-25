"""Admin-managed knowledge: building the index from API documents and reloading it live."""

from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient

from app.knowledge import KnowledgeBase, KnowledgeError, documents_digest
from app.main import create_app
from tests.support import AI_TOKEN, KNOWLEDGE, FakeMarketplace, make_settings, worker

AUTH = {"Authorization": f"Bearer {AI_TOKEN}"}

REFUND_DOC = {
    "id": "safety-tips",
    "title": "Staying safe",
    "url": "/help",
    "body": "# Meeting a professional\nAlways keep conversations and payments inside FixedItNow. Never share your one time code with anyone.",
}
OTHER_DOC = {
    "id": "tipping",
    "title": "Tipping",
    "url": "/help",
    "body": "# Tipping a professional\nTipping is optional. FixedItNow never adds a tip to the price; it is agreed between you and the professional.",
}


def build(market: FakeMarketplace, source: str = "api") -> TestClient:
    app = create_app(make_settings(AI_KNOWLEDGE_SOURCE=source), http=market.client())
    return TestClient(app, raise_server_exceptions=False)


class TestFromDocuments:
    def test_builds_chunks_with_stable_ids(self):
        kb = KnowledgeBase.from_documents([REFUND_DOC, OTHER_DOC])
        assert kb.source == "api" and kb.skipped == 0
        assert [c.id for c in kb.chunks] == ["safety-tips#meeting-a-professional", "tipping#tipping-a-professional"]
        assert kb.search("never share my one time code")[0].chunk.doc_id == "safety-tips"

    def test_digest_ignores_order_and_follows_content(self):
        a = KnowledgeBase.from_documents([REFUND_DOC, OTHER_DOC]).digest
        assert a == KnowledgeBase.from_documents([OTHER_DOC, REFUND_DOC]).digest
        assert a != KnowledgeBase.from_documents([REFUND_DOC, {**OTHER_DOC, "body": OTHER_DOC["body"] + " Ever."}]).digest

    def test_digest_matches_the_documented_algorithm(self):
        # The main API (TypeScript) computes the same value; this pins the format both sides rely on.
        expected = hashlib.sha256()
        for doc in sorted([REFUND_DOC, OTHER_DOC], key=lambda d: d["id"]):
            expected.update(f"{doc['id']}\0{doc['title']}\0{doc['url']}\0{doc['body']}\0".encode())
        assert documents_digest([OTHER_DOC, REFUND_DOC]) == expected.hexdigest()

    @pytest.mark.parametrize(
        "bad",
        [
            {**REFUND_DOC, "id": "Bad Id"},
            {**REFUND_DOC, "id": ""},
            {**REFUND_DOC, "url": "https://evil.example"},
            {**REFUND_DOC, "url": "help"},
            {**REFUND_DOC, "title": ""},
            {**REFUND_DOC, "body": "   "},
            {**REFUND_DOC, "body": "x" * (64 * 1024 + 1)},
        ],
    )
    def test_invalid_documents_are_refused(self, bad):
        with pytest.raises(KnowledgeError):
            KnowledgeBase.from_documents([bad])

    def test_duplicate_ids_are_refused(self):
        with pytest.raises(KnowledgeError):
            KnowledgeBase.from_documents([REFUND_DOC, REFUND_DOC])

    def test_an_empty_set_is_a_valid_empty_index(self):
        kb = KnowledgeBase.from_documents([])
        assert kb.chunks == [] and kb.search("anything at all") == []


class TestReloadEndpoint:
    def test_requires_the_service_token(self):
        market = FakeMarketplace([worker("w1")])
        with build(market) as client:
            assert client.post("/v1/knowledge/reload").status_code == 401
            assert client.post("/v1/knowledge/reload", headers={"Authorization": "Bearer wrong"}).status_code == 401
            assert client.get("/v1/knowledge").status_code == 401

    def test_api_source_is_loaded_at_start_and_reloaded_on_demand(self):
        market = FakeMarketplace([worker("w1")])
        market.knowledge_docs = [REFUND_DOC]
        with build(market) as client:
            status = client.get("/v1/knowledge", headers=AUTH).json()
            assert status["source"] == "api" and status["documents"] == 1 and status["configuredSource"] == "api"
            assert status["digest"] == documents_digest([REFUND_DOC])
            assert "body" not in str(status)  # no document text is exposed

            market.knowledge_docs = [REFUND_DOC, OTHER_DOC]
            reloaded = client.post("/v1/knowledge/reload", headers=AUTH)
            assert reloaded.status_code == 200
            assert reloaded.json()["documents"] == 2 and reloaded.json()["digest"] == documents_digest(
                [REFUND_DOC, OTHER_DOC]
            )
            assert client.get("/health").json()["knowledgeChunks"] == 2

    def test_a_failed_reload_keeps_the_previous_index(self):
        market = FakeMarketplace([worker("w1")])
        market.knowledge_docs = [REFUND_DOC]
        with build(market) as client:
            before = client.get("/v1/knowledge", headers=AUTH).json()
            for broken in (None, [{**REFUND_DOC, "url": "javascript:alert(1)"}], [REFUND_DOC, REFUND_DOC]):
                market.knowledge_docs = broken
                response = client.post("/v1/knowledge/reload", headers=AUTH)
                assert response.status_code == 502 and response.json()["code"] == "KNOWLEDGE_UNAVAILABLE"
                assert client.get("/v1/knowledge", headers=AUTH).json() == before
            market.down = True
            assert client.post("/v1/knowledge/reload", headers=AUTH).status_code == 502
            assert client.get("/v1/knowledge", headers=AUTH).json() == before

    def test_start_falls_back_to_the_bundled_files_when_the_api_is_unreachable(self):
        market = FakeMarketplace([worker("w1")], down=True)
        with build(market) as client:
            status = client.get("/v1/knowledge", headers=AUTH).json()
        assert status["source"] == "files" and status["configuredSource"] == "api"
        assert status["digest"] == KnowledgeBase.load(KNOWLEDGE).digest

    def test_files_source_reloads_the_bundled_files_and_never_calls_the_api_for_knowledge(self):
        market = FakeMarketplace([worker("w1")])
        market.knowledge_docs = [OTHER_DOC]
        with build(market, source="files") as client:
            reloaded = client.post("/v1/knowledge/reload", headers=AUTH).json()
        assert reloaded["source"] == "files" and reloaded["digest"] == KnowledgeBase.load(KNOWLEDGE).digest
        assert not [r for r in market.requests if r.url.path.endswith("/knowledge")]

    def test_answers_come_from_the_reloaded_documents(self):
        market = FakeMarketplace([worker("w1")])
        market.knowledge_docs = [REFUND_DOC]
        with build(market) as client:
            ask = lambda: client.post("/v1/chat", json={"message": "how do I tip a professional"}, headers=AUTH).json()  # noqa: E731
            assert ask()["answer"] is None  # nothing in the published set covers tipping yet
            market.knowledge_docs = [REFUND_DOC, OTHER_DOC]
            assert client.post("/v1/knowledge/reload", headers=AUTH).status_code == 200
            answer = ask()["answer"]
        assert answer["grounded"] is True and answer["sources"][0]["id"] == "tipping#tipping-a-professional"
