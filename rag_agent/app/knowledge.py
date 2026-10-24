"""Curated knowledge base + lexical retrieval (BM25).

Why not embeddings/pgvector: the approved corpus is a few dozen short, curated
passages. Lexical ranking is deterministic, needs no new infrastructure, and is
easy to test. Revisit when the corpus is large or needs cross-language recall.

"Ingestion" = loading `knowledge/*.md` at start-up. It is a pure function of the
files (stable chunk ids, content hash), so repeating it can never create
duplicates, and a changed or deleted file is reflected on the next start.
Only documents marked `audience: public` are indexed.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

URL_PATTERN = re.compile(r"^/[a-z0-9\-/]*$")
ID_PATTERN = re.compile(r"^[a-z0-9-]{1,40}$")
MAX_CHUNK_CHARS = 900
MAX_FILE_BYTES = 64 * 1024

_STOP = frozenset(
    "a an and are as at be but by can could do does for from has have how i if in is it its me my of on or "
    "our should so that the their then there these they this to was we what when where which who why will with "
    "you your about get got happen happens".split()
)
_TOKEN = re.compile(r"\w+", re.UNICODE)


class KnowledgeError(Exception):
    pass


@dataclass(frozen=True)
class Chunk:
    id: str
    doc_id: str
    title: str
    heading: str
    url: str
    text: str


@dataclass(frozen=True)
class Hit:
    chunk: Chunk
    score: float
    coverage: float


def _stem(token: str) -> str:
    token = token.lower()
    if not token.isascii() or len(token) <= 4:
        return token
    for suffix in ("ing", "ed", "es", "s"):
        if token.endswith(suffix) and len(token) - len(suffix) >= 4:
            token = token[: -len(suffix)]
            break
    if len(token) > 4 and token[-1] == token[-2] and token[-1] not in "sz":
        token = token[:-1]
    return token


def tokenize(text: str) -> list[str]:
    return [_stem(t) for t in _TOKEN.findall(text) if t.lower() not in _STOP and len(t) > 1]


def _slug(heading: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", heading.lower()).strip("-")[:40] or "section"


def _parse(path: Path) -> tuple[dict[str, str], str]:
    raw = path.read_bytes()
    if len(raw) > MAX_FILE_BYTES:
        raise KnowledgeError(f"{path.name}: file too large")
    text = raw.decode("utf-8")
    if not text.startswith("---\n"):
        raise KnowledgeError(f"{path.name}: missing frontmatter")
    head, sep, body = text[4:].partition("\n---\n")
    if not sep:
        raise KnowledgeError(f"{path.name}: unterminated frontmatter")
    meta: dict[str, str] = {}
    for line in head.splitlines():
        key, colon, value = line.partition(":")
        if colon:
            meta[key.strip()] = value.strip()
    return meta, body


def _split_sections(body: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, list[str]]] = [("Overview", [])]
    for line in body.splitlines():
        if line.startswith("# "):
            sections.append((line[2:].strip(), []))
        else:
            sections[-1][1].append(line)
    out = []
    for heading, lines in sections:
        content = "\n".join(lines).strip()
        if content:
            out.append((heading, content))
    return out


def _pieces(content: str) -> list[str]:
    if len(content) <= MAX_CHUNK_CHARS:
        return [content]
    pieces: list[str] = []
    current = ""
    for para in re.split(r"\n\s*\n|(?<=[.!?])\s+", content):
        if current and len(current) + len(para) + 1 > MAX_CHUNK_CHARS:
            pieces.append(current)
            current = para
        else:
            current = f"{current} {para}".strip()
    if current:
        pieces.append(current)
    return pieces


class KnowledgeBase:
    def __init__(self, chunks: list[Chunk], skipped: int, digest: str) -> None:
        self.chunks = chunks
        self.skipped = skipped
        self.digest = digest
        self._tokens = [Counter(tokenize(f"{c.title} {c.heading} {c.text}")) for c in chunks]
        self._lengths = [sum(t.values()) for t in self._tokens]
        self._avg = (sum(self._lengths) / len(self._lengths)) if self._lengths else 0.0
        df: Counter[str] = Counter()
        for tokens in self._tokens:
            df.update(tokens.keys())
        self._df = df

    @classmethod
    def load(cls, directory: Path) -> KnowledgeBase:
        if not directory.is_dir():
            raise KnowledgeError("knowledge directory not found")
        chunks: list[Chunk] = []
        seen_docs: set[str] = set()
        skipped = 0
        digest = hashlib.sha256()
        for path in sorted(directory.glob("*.md")):
            meta, body = _parse(path)
            digest.update(path.name.encode() + b"\0" + path.read_bytes())
            if meta.get("audience") != "public":
                skipped += 1  # internal or unlabeled documents are never indexed
                continue
            doc_id, title, url = meta.get("id", ""), meta.get("title", ""), meta.get("url", "")
            if not ID_PATTERN.match(doc_id) or not title or not URL_PATTERN.match(url):
                raise KnowledgeError(f"{path.name}: invalid id, title or url")
            if doc_id in seen_docs:
                raise KnowledgeError(f"{path.name}: duplicate document id")
            seen_docs.add(doc_id)
            used: set[str] = set()
            for heading, content in _split_sections(body):
                for index, piece in enumerate(_pieces(content)):
                    base = f"{doc_id}#{_slug(heading)}" + (f"-{index + 1}" if index else "")
                    chunk_id = base
                    n = 2
                    while chunk_id in used:
                        chunk_id = f"{base}~{n}"
                        n += 1
                    used.add(chunk_id)
                    chunks.append(Chunk(chunk_id, doc_id, title, heading, url, piece))
        return cls(chunks, skipped, digest.hexdigest())

    def manifest(self) -> dict[str, object]:
        return {
            "digest": self.digest,
            "documents": len({c.doc_id for c in self.chunks}),
            "chunks": [c.id for c in self.chunks],
            "skipped": self.skipped,
        }

    def search(self, query: str, limit: int = 3, min_coverage: float = 0.6, min_score: float = 0.0) -> list[Hit]:
        """BM25 over chunks. A hit must cover enough of the query's distinct terms,
        so an unrelated question returns nothing instead of the least-bad chunk."""
        terms = list(dict.fromkeys(tokenize(query)))
        if not terms or not self.chunks:
            return []
        n = len(self.chunks)
        k1, b = 1.5, 0.75
        hits: list[Hit] = []
        for chunk, tokens, length in zip(self.chunks, self._tokens, self._lengths, strict=True):
            score = 0.0
            matched = 0
            for term in terms:
                tf = tokens.get(term, 0)
                if not tf:
                    continue
                matched += 1
                idf = math.log(1 + (n - self._df[term] + 0.5) / (self._df[term] + 0.5))
                score += idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * length / (self._avg or 1)))
            coverage = matched / len(terms)
            if score > min_score and coverage >= min_coverage:
                hits.append(Hit(chunk, score, coverage))
        hits.sort(key=lambda h: (-h.score, h.chunk.id))
        return hits[:limit]


def main() -> None:  # python -m app.knowledge [dir]
    import json
    import sys

    directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "knowledge"
    print(json.dumps(KnowledgeBase.load(directory).manifest(), indent=2))


if __name__ == "__main__":
    main()
