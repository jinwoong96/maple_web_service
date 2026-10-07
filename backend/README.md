# backend

FastAPI backend for maple_web_service.

## Setup

```
uv sync
```

## Run (dev)

```
uv run uvicorn app.main:app --reload
```

## Test

```
uv run pytest
```

## Database migrations (Alembic)

Requires `DATABASE_URL` to point at a running PostgreSQL instance (see `.env.example`).

```
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```
