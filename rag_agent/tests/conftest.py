from __future__ import annotations

import logging

import pytest

from app.knowledge import KnowledgeBase
from app.llm.base import LLMClient
from app.marketplace import MarketplaceClient
from app.obs import Metrics
from app.pipeline import Pipeline
from tests.support import KNOWLEDGE, FakeMarketplace, make_settings, worker


@pytest.fixture(scope="session")
def kb() -> KnowledgeBase:
    return KnowledgeBase.load(KNOWLEDGE)


@pytest.fixture
def workers() -> list[dict]:
    return [
        worker("w1", years=10, price=700),
        worker("w2", years=4, price=1200),
        worker("w3", years=7, price=2500),
        worker("e1", category="electrical", areas=("Sylhet", "Dhaka"), years=6, price=500),
    ]


@pytest.fixture
def market(workers: list[dict]) -> FakeMarketplace:
    return FakeMarketplace(workers)


@pytest.fixture
def make_pipeline(market: FakeMarketplace, kb: KnowledgeBase):
    def build(llm: LLMClient | None = None, fake: FakeMarketplace | None = None) -> tuple[Pipeline, FakeMarketplace]:
        fake = fake or market
        settings = make_settings()
        return Pipeline(llm, MarketplaceClient(settings, fake.client()), kb, settings.max_results), fake

    return build


@pytest.fixture
def metrics() -> Metrics:
    return Metrics("corr-test-1234")


@pytest.fixture(autouse=True)
def _quiet_logs(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="fixeditnow.ai")
