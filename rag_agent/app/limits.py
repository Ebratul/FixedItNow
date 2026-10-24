"""In-memory sliding-window rate limiter (per process)."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from collections.abc import Callable


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float = 60.0, clock: Callable[[], float] = time.monotonic) -> None:
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = self._clock()
        hits = self._hits[key]
        while hits and now - hits[0] >= self._window:
            hits.popleft()
        if not hits:
            # drop idle keys so memory stays bounded
            if len(self._hits) > 10_000:
                self._hits = defaultdict(deque, {k: v for k, v in self._hits.items() if v})
                hits = self._hits[key]
        if len(hits) >= self._limit:
            return False
        hits.append(now)
        return True
