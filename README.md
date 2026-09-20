# DevMind AI

**Multi-Agent Code Intelligence Workspace for Software Teams**

DevMind AI indexes your GitHub repositories and technical documentation, then answers
questions about your codebase using retrieval-augmented generation (RAG) and a
LangGraph-based multi-agent workflow — not a single prompt wrapped around your repo.
Every answer is grounded in retrieved evidence, reviewed before it's shown to you, and
cited down to the exact file and line range.

---

## 1. Architecture summary

```
Browser (Next.js) ──HTTPS/SSE──▶ FastAPI (Python) ──▶ PostgreSQL + pgvector
                                        │                     ▲
                                        ├──▶ Redis ──▶ Celery workers (ingestion)
                                        │
                                        └──▶ LangGraph agent graph ──▶ LLM provider
                                                                       (OpenAI-compatible)
```

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS, talking to the API
  over REST and Server-Sent Events (SSE) for streaming chat.
- **Backend**: FastAPI + SQLAlchemy 2.0 (async) + Alembic, organized into
  `routes / schemas / services / agents / rag / repositories / workers / core / db`.
- **Database**: PostgreSQL with the `pgvector` extension for embeddings and native
  full-text search (`tsvector`/GIN) for keyword retrieval.
- **Background jobs**: Redis + Celery for repository/document ingestion, so indexing
  never blocks an HTTP request.
- **AI**: LangGraph orchestrates a supervisor + five specialist agents + a reviewer,
  calling an OpenAI-compatible LLM and embeddings provider (works with real OpenAI or
  any compatible gateway/self-hosted endpoint).

## 2. Implemented features

- Auth: register/login/logout/refresh, bcrypt password hashing, JWT access+refresh
  tokens, per-workspace project isolation (cross-user access returns 404, not 403).
- Projects: CRUD, archive, per-project stats (repos, docs, chunks, conversations, runs).
- GitHub ingestion: repo tree traversal via the GitHub API, noise/size filtering,
  incremental re-indexing via content hashing, re-sync, and pruning of deleted files.
- Document ingestion: PDF/DOCX/Markdown/TXT upload, validation, background text
  extraction, status tracking (`uploaded → processing → indexed/failed`).
- RAG pipeline: code-aware chunking (Python `ast`, regex-based signatures for other
  languages, sliding-window fallback) and document-aware chunking (Markdown headings,
  paragraph-aware splitting) → OpenAI-compatible embeddings → pgvector.
- Hybrid retrieval: vector similarity + PostgreSQL full-text search fused via
  Reciprocal Rank Fusion, then reranked (configurable LLM-judge reranker, with a free
  heuristic fallback when none is configured).
- Multi-agent orchestration (LangGraph): Supervisor classifies the question and routes
  to only the specialist agents it needs (Code Retrieval, Documentation, Debugging,
  Architecture, Implementation Planning); a Reviewer agent checks every claim against
  retrieved evidence and can trigger a bounded targeted-retrieval retry loop.
- Streaming chat: the reviewer-approved answer is generated with real token-level
  streaming (SSE) once evidence is validated.
- Citations: stored separately from generated prose, always traceable back to a real
  retrieved chunk — the LLM cannot invent a citation that wasn't actually retrieved.
- Agent Runs UI: full execution trace (agent, status, duration, tool calls, retrieved
  count, tokens) without exposing private chain-of-thought.
- Conversation history: create/rename/delete/reopen, auto-titled from the first
  question, bounded context window sent to the model.
- RAG evaluation framework: Recall@K / MRR over a labeled dataset (`apps/api/eval/`).
- Tests: pytest backend suite (auth, project isolation, document validation, hybrid
  retrieval, agent-graph citation integrity) and a Vitest frontend suite — all external
  LLM/embedding calls are mocked, no paid API calls required to run them.
- Docker Compose for Postgres+pgvector, Redis, API, worker, and web.

## 3. Directory structure

```
devmind-ai/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   └── src/
│   │       ├── app/          # App Router pages (landing, auth, dashboard, projects...)
│   │       ├── components/   # UI primitives, chat, layout, agent-run components
│   │       ├── hooks/        # useAuth context
│   │       ├── lib/          # API client, SSE consumer, shared types
│   │       └── tests/        # Vitest tests
│   └── api/                  # FastAPI backend
│       ├── app/
│       │   ├── routes/       # HTTP endpoints
│       │   ├── schemas/      # Pydantic request/response models
│       │   ├── models/       # SQLAlchemy ORM models
│       │   ├── services/     # Business logic (auth, projects, ingestion, GitHub OAuth)
│       │   ├── agents/       # LangGraph state, nodes, graph, runner, prompts
│       │   ├── rag/          # Chunking, embeddings, hybrid search, reranking, eval
│       │   ├── repositories/ # GitHub ingestion + file filtering
│       │   ├── workers/      # Celery app + tasks
│       │   ├── core/         # Config, security, logging, rate limiting, dependencies
│       │   ├── db/           # Base, session, seed
│       │   └── tests/        # pytest suite
│       ├── alembic/          # Migrations
│       └── eval/             # Retrieval evaluation script + example dataset
├── packages/shared/           # Reserved for cross-app shared types (currently empty)
├── docker-compose.yml
├── .env.example
└── README.md
```

## 4. Prerequisites

- Docker + Docker Compose (recommended path), **or**
- Python 3.12, Node.js 20, PostgreSQL 16 with `pgvector`, and Redis 7 for running
  services natively.
- An OpenAI (or OpenAI-compatible) API key for `LLM_API_KEY` / `EMBEDDING_API_KEY`.
  Without this, the app runs but ingestion/chat will return clear configuration
  errors rather than fail silently.
- Optional: a GitHub OAuth App (`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`) if you want
  the OAuth token-exchange endpoints; a plain personal access token pasted into the
  "Connect repository" dialog works without OAuth for both public and private repos.

## 5. Environment variables

Copy `.env.example` to `.env` at the repo root and fill in real values:

```bash
cp .env.example .env
```

Key variables (see `.env.example` for the full, commented list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Async Postgres connection string used by the API/worker |
| `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | Redis/Celery wiring |
| `JWT_SECRET` | Symmetric secret for signing access/refresh tokens |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` | Chat completion provider |
| `EMBEDDING_PROVIDER`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` | Embeddings provider |
| `RERANKER_PROVIDER`, `RERANKER_MODEL` | Optional reranker; `none` uses the built-in heuristic |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_DEFAULT_TOKEN` | GitHub integration |
| `UPLOAD_DIR`, `MAX_UPLOAD_SIZE_MB` | Document upload limits |
| `RATE_LIMIT_CHAT_PER_MINUTE`, `RATE_LIMIT_INGESTION_PER_HOUR` | Abuse protection |
| `ENABLE_DEV_SEED` | Set `true` to create a demo user locally (never in production) |
| `NEXT_PUBLIC_API_URL` | Base URL the frontend uses to reach the API |

## 6. Running locally with Docker (recommended)

```bash
cp .env.example .env    # fill in LLM_API_KEY / EMBEDDING_API_KEY at minimum
docker compose up --build
```

This starts Postgres (with pgvector), Redis, the API (auto-runs migrations on start),
a Celery worker, and the Next.js dev server.

- Frontend: http://localhost:3000
- API + interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

To seed a demo account (development only):

```bash
# set ENABLE_DEV_SEED=true in .env first, then:
docker compose exec api python -m app.db.seed
```

## 7. Running natively (without Docker)

**Database & Redis** (still easiest via Docker, or install locally):
```bash
docker compose up -d postgres redis
```

Copy `.env.example` to `apps/api/.env` for native runs, and set the database and
Redis URLs to your local service addresses. Set `UPLOAD_DIR=uploads`. The API,
worker, seed script, and Alembic read `.env` from their working directory.

**Backend**:
```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

**Celery worker** (separate terminal):
```bash
cd apps/api && celery -A app.workers.celery_app worker --loglevel=info
```

**Frontend**:
```bash
cd apps/web
cp .env.local.example .env.local
npm install
npm run dev
```

## 8. Database migrations

```bash
cd apps/api
alembic upgrade head                        # apply migrations
alembic revision --autogenerate -m "..."    # generate a new migration after model changes
alembic downgrade -1                        # roll back one migration
```

Or via Docker: `docker compose exec api alembic upgrade head`.

## 9. Testing

**Backend** (requires a dedicated Postgres+pgvector test database whose name ends
in `_test`; the suite creates and drops tables, and refuses the application
database. External LLM/embedding calls are mocked):
```bash
createdb devmind_test        # use your local Postgres connection options
cd apps/api
export DATABASE_URL=postgresql+asyncpg://devmind:devmind_local_password@localhost:5432/devmind_test
pytest                      # full suite
pytest --cov=app            # with coverage
```

**Frontend**:
```bash
cd apps/web
npm run test                # Vitest, run once
npm run typecheck           # tsc --noEmit
npm run lint                # eslint
```

**Retrieval evaluation** (Recall@K / MRR against an already-indexed project):
```bash
cd apps/api
python -m eval.run_evaluation <project_id> --dataset eval/dataset.example.json --k 5
```

## 10. RAG architecture

```
Source (repo file / uploaded doc)
  → extraction (GitHub API blob / pypdf / python-docx / plain read)
  → normalization
  → chunking (code: ast/regex boundaries · docs: heading/paragraph aware)
  → metadata (project, source, file path/language or document name, section,
              start/end line, content hash)
  → embeddings (OpenAI-compatible, batched, retried)
  → pgvector storage (HNSW index, cosine distance) + generated tsvector column (GIN)
  → hybrid retrieval (vector + full-text, fused with Reciprocal Rank Fusion)
  → reranking (LLM-judge if configured, else a free lexical-overlap heuristic)
  → context construction (numbered, labeled evidence passed to agents)
  → agent reasoning + reviewer verification
  → cited, streamed response
```

Incremental indexing: each `KnowledgeSource` stores a `content_hash`; unchanged files
are skipped on re-index (no wasted embedding calls), and files removed from a repo are
pruned from the knowledge base on re-sync.

## 11. Agent architecture

```
START → Supervisor (classifies task, picks 0+ specialists)
           │
           ├─▶ Code Retrieval Agent ─────┐
           ├─▶ Documentation Agent ──────┤
           ├─▶ Debugging Agent ──────────┼─▶ Reviewer
           ├─▶ Architecture Agent ───────┤      │
           └─▶ Implementation Planning ──┘      ├─ SUPPORTED → stream synthesized,
                                                 │              cited answer → END
                                                 └─ NEEDS_MORE_EVIDENCE (bounded retries)
                                                        → Targeted Retrieval → Reviewer
```

- Shared, typed `AgentState` (see `apps/api/app/agents/state.py`) uses reducers so
  parallel specialist branches merge their evidence/outputs safely.
- Tools (`apps/api/app/agents/tools.py`) are explicit, structured functions
  (`search_code`, `search_documents`, `get_file_content`, `find_symbol`,
  `get_repository_tree`, `retrieve_related_chunks`, ...), always scoped to the
  authorized project.
- The Reviewer never fabricates citations: the synthesis prompt is given a numbered
  evidence list and instructed to cite only those numbers; citations persisted to the
  database are built directly from the evidence objects the graph actually retrieved,
  not parsed out of the LLM's free-text output.
- Retries are capped (`MAX_REVIEW_RETRIES = 2`) to prevent infinite loops.
- No private chain-of-thought is exposed — the UI shows tool calls, retrieval counts,
  and short agent summaries, not raw reasoning traces.

## 12. Security considerations

- Passwords hashed with bcrypt; JWT access (short-lived) + refresh (long-lived) tokens.
- Project access is enforced by workspace membership on every project-scoped route;
  unauthorized access returns 404 (not 403) to avoid confirming a resource's existence.
- Repository/document content is treated as **untrusted data**: every agent prompt
  explicitly instructs the model to treat retrieved snippets as evidence, never as
  instructions, guarding against prompt injection embedded in indexed content.
- Uploads are validated by type/size, stored under UUID-based filenames (no path
  traversal from user-supplied names), and size-limited.
- GitHub tokens are never persisted server-side — they're used only for the duration
  of a single ingestion job. (Production hardening note: a real deployment should
  encrypt and store per-user GitHub tokens in a dedicated secrets-aware table rather
  than passing them through the Celery task payload each time.)
- Rate limiting (Redis, fixed-window) on chat and ingestion endpoints.
- CORS restricted to the configured frontend origin; provider API keys never reach
  the browser — the frontend only ever talks to the DevMind API.
- Structured logging redacts secrets/tokens/passwords before they're ever emitted.

## 13. Screenshots

_Add screenshots here after running the app locally (e.g. dashboard, AI Workspace
chat with citations, agent run trace)._

## 14. Deployment guidance

- Run `docker compose -f docker-compose.yml up --build -d` on a host with persistent
  volumes for Postgres/Redis/uploads, behind a reverse proxy (TLS termination) in
  front of both the `web` and `api` services.
- Set `ENVIRONMENT=production`, a strong random `JWT_SECRET`, real provider keys, and
  leave `ENABLE_DEV_SEED=false`.
- Point `NEXT_PUBLIC_API_URL` and `FRONTEND_URL`/`BACKEND_URL` at your real public
  hostnames so CORS and links resolve correctly.
- Scale Celery workers horizontally for larger repositories; `task_time_limit` is set
  to 30 minutes per ingestion job as a safety bound.
- Configure `LLM_INPUT_PRICE_PER_1M_TOKENS`/`LLM_OUTPUT_PRICE_PER_1M_TOKENS` to your
  actual provider rates if you want cost estimates in Agent Run details.

## 15. Known limitations

- GitHub OAuth exchanges a code for a token but the frontend doesn't yet implement the
  full authorize-redirect UI flow — connecting a private repo today is done by pasting
  a personal access token into the "Connect repository" dialog (the token is used for
  that ingestion job only and is never stored).
- Local verification (2026-09-20): dependencies installed; Alembic migration and
  demo seed succeeded; 22 backend tests and 12 frontend tests passed; frontend
  typecheck and lint passed. Login and project creation were verified in Chrome
  against the real API and PostgreSQL database, with a Redis-backed Celery worker
  running. Docker Compose itself has not been run (Docker is not installed on the
  verification machine). Live LLM/embedding calls remain unverified without keys.
- The reranker's LLM-judge mode and the heuristic fallback are both implemented, but
  only the heuristic path has been exercised without a live provider; enable
  `RERANKER_PROVIDER` deliberately and watch its logs the first time.
- No CI pipeline is included; `pytest`/`npm run test`/`npm run typecheck`/`npm run
  lint` are meant to be wired into one (e.g. GitHub Actions) for a real team.
