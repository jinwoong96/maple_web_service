# maple_web_service — Development Rules

Monorepo full-stack service: **React (TypeScript)** frontend + **FastAPI (Python)** backend, **PostgreSQL** database. Future scope may include LLM/AI API integration — keep that path clean from the start (see "AI/LLM Integration" below).

## Repository Layout

```
maple_web_service/
├── frontend/          # React + TypeScript (Vite)
├── backend/           # FastAPI (Python, uv-managed)
├── docs/              # architecture notes, ADRs (only when non-obvious decisions need recording)
└── CLAUDE.md
```

Each side (`frontend/`, `backend/`) is independently runnable and independently tested. Do not introduce a shared build tool (Nx/Turborepo) unless the two sides start sharing generated code (e.g. OpenAPI-generated types) and plain scripts become unwieldy.

## Tooling

- **Backend package manager: `uv`.** No `pip install` / `requirements.txt` in day-to-day use — dependencies live in `pyproject.toml`, lockfile is `uv.lock`. Run backend commands via `uv run ...`.
- **Frontend package manager: `pnpm`.** No `npm install` / `package-lock.json`. Commit `pnpm-lock.yaml`.
- Both are new tools for the primary developer — when a command differs meaningfully from the npm/pip equivalent, say so briefly instead of assuming familiarity.

## Backend (FastAPI)

- **Python version**: pin one version in `pyproject.toml` (`requires-python`); do not support a range.
- **Type hints are required** on all function signatures (params + return). Run `mypy` (or `pyright`) in CI/pre-commit — do not merge code that fails type checking.
- **Lint/format**: `ruff` for both linting and formatting. No `black`/`flake8` alongside it.
- **Layering** — keep these separate, never let a router import the DB session directly:
  - `api/` — routers only: request/response wiring, no business logic.
  - `schemas/` — Pydantic v2 models for request/response bodies. Never expose SQLAlchemy models directly through the API.
  - `services/` — business logic, orchestration.
  - `models/` — SQLAlchemy ORM models.
  - `db/` — session/engine setup, Alembic migrations.
  - `core/` — settings, security, shared config.
- **Async-first**: use `async def` endpoints and async SQLAlchemy (`asyncpg` driver). Don't mix sync DB calls into async request handlers.
- **Config/secrets**: `pydantic-settings`, values from `.env` (never committed — must be in `.gitignore`). No hardcoded credentials or API keys anywhere in source.
- **Migrations**: Alembic. Every model change ships with a migration in the same change.
- **Errors**: raise typed/custom exceptions in `services/`; translate to HTTP responses via FastAPI exception handlers in one place, not ad-hoc `HTTPException` scattered through routers. All error responses share one JSON shape.
- **Tests**: `pytest` + `pytest-asyncio`, `httpx.AsyncClient` against the app. New endpoints and non-trivial service logic need tests before merge.

### AI/LLM Integration (forward-looking)

- Isolate any LLM/AI provider calls behind a `services/ai/` (or similar) module — routers and other services call *that*, never an SDK directly. Keeps provider swaps and mocking-in-tests cheap.
- API keys via env/settings only, same as any other secret.
- Wrap external calls with explicit timeouts; don't let an LLM call block a request indefinitely.
- If cost/usage matters, log token/request counts at the boundary of that module, not scattered at call sites.

## Frontend (React + TypeScript)

- **Build tool**: Vite. **Language**: TypeScript everywhere — no new `.js`/`.jsx` files.
- **Server state**: TanStack Query for anything that talks to the backend. Don't hand-roll `useEffect` + `fetch` + loading/error state.
- **Client state**: local component state / context by default; reach for a global store (Zustand) only when state is genuinely cross-cutting.
- **API types**: generate frontend request/response types from the backend's OpenAPI schema (e.g. `openapi-typescript`) rather than hand-writing duplicate interfaces — FastAPI already produces the schema for free.
- **Lint/format**: `eslint` + `prettier`. No unformatted/unlinted code merged.
- **Styling**: Tailwind CSS v4 via the `@tailwindcss/vite` plugin (no separate `tailwind.config.js`/PostCSS setup needed — v4 configures through CSS `@import "tailwindcss"` and the Vite plugin).

## API Conventions

- Version the API surface: `/api/v1/...`.
- Consistent JSON response shape for both success and error payloads.
- Backend is the source of truth for validation (Pydantic schemas) — frontend validation is UX-only, never the last line of defense.

## Git Conventions

- **Commit messages**: Conventional Commits prefixes (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`) with the description written in Korean, e.g. `feat: 회원가입 API 추가`.
- **Workflow**: `feature branch → Pull Request → main`. No direct commits to `main`; every change lands via a PR, even solo. Branch names: `feature/<short-description>`, `fix/<short-description>`.

## Planning Docs

- Per-feature-domain specs follow a plan-first workflow: write the plan before
  implementing, mock up user-facing screens before coding, pay down small debt
  as you touch a domain. These planning docs live in the private development
  repository and are not part of this public snapshot.

## Review Notes

- `REVIEW_NOTES.md` (repo root, gitignored) tracks things that still need the developer's attention: unverified assumptions, known API quirks, edge cases to double-check before relying on new code. It's a personal working file, not documentation — never commit it.
- When an item gets resolved (verified against a real response, fixed, or otherwise no longer relevant), move it — don't just delete it — into `REVIEW_NOTES_HISTORY.md` (same directory, also gitignored), with a short note on how/when it was resolved (e.g. which PR fixed it). This keeps a local record of what was checked without cluttering the active list.
- Neither file replaces commit messages, PR descriptions, or `docs/` — they're scratch notes for this developer's own tracking, not project documentation.

## General

- Don't add abstractions, config options, or infrastructure (Docker, CI, Nx, etc.) ahead of actual need — this project starts from an empty folder, so prefer the smallest structure that works and grow it when a real requirement shows up.
- Keep `docs/` for decisions that aren't obvious from the code (why Postgres, why a given library was swapped) — not for restating what the code already shows.
