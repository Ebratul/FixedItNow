# rag_agent

The AI service-discovery assistant (Python, FastAPI). Only rag_agent code belongs here.
Design, API, safety rules and limitations: [docs/AI.md](../docs/AI.md).

```
app/            service code (config, pipeline, extraction, knowledge, marketplace client, OpenRouter adapter, safety)
knowledge/      curated public documents the assistant may quote (front matter: audience, id, title, url)
evals/          offline evaluation set + runner
tests/          pytest suite (no network, no paid calls)
```

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # set the two service tokens; OPENROUTER_* optional
set -a; . ./.env; set +a; .venv/bin/python -m app

.venv/bin/pytest -q && .venv/bin/ruff check . && .venv/bin/mypy
.venv/bin/python -m evals.run_eval
.venv/bin/python -m app.knowledge      # print the knowledge-base manifest
.venv/bin/python -m app.vector_store check     # with PINECONE_* set: sync the knowledge to Pinecone and run one search
```

The service has no database access (the optional Pinecone index holds only the public knowledge text) and is never called by browsers. It starts without OpenRouter credentials
(rule-based "simple mode"). No real OpenRouter request has been made with this code.
