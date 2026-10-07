# maple_web_service

MapleStory character/union/guild/battle-practice/ranking/notice lookup service,
built on Nexon's Open API. React (TypeScript) frontend + FastAPI backend,
PostgreSQL (not required for the features that exist today — see below).

> This repository is a public snapshot (2026-10-08) of a privately developed project,
> shared as a portfolio. Feature planning documents are not included.

## 대표 기능: 길드원 주간 점수 스크린샷 OCR

길드 운영진이 매주 길드원 약 200명의 컨텐츠 점수를 게임 화면에서 손으로 옮겨 적던 일을,
**스크린샷을 올리면 브라우저에서 읽어 길드원 명단과 맞춰 주는** 기능으로 바꿨다.
게임 화면은 어두운 배경에 12px 남짓한 한글이라 OCR(tesseract.js)이 특히 약한 조건이어서,
실제 스크린샷으로 한 단계씩 재며 고쳤다.

| 개선 | 자동 처리율 변화 (실측 12장) |
| --- | --- |
| 전처리: 명암 반전 + 2배 확대 (직접 이진화는 55%, 3·4배 확대는 56%·23%로 오히려 하락해 제외) | 50% → 71% |
| 글자 대신 화면 x좌표로 표의 열 복원 (줄 텍스트 파싱 대비) | 65% → 71% |
| 한글 전용으로 한 번 더 읽고, 명단에 더 잘 맞는 쪽 선택 | 71% → 79% |
| 읽다 만 표 다시 읽기, 직업 열 구분, 점수 칸 재인식, 후보 좁히기 등 | **최종 94.2%** (직업·레벨로 한 번 더 가려내면 **96.6%**) |

- 최종값은 실제 스크린샷 12장(206줄)을 한꺼번에 올린 결과다. 남은 줄은 사람이 고르기 쉽게
  해당 줄의 스크린샷 조각과 후보를 함께 보여준다.
- 닉네임 매칭은 실제 명단 1,024명에 관측된 오인식 유형(자모 뒤바뀜, 받침 누락, 괄호 잘림 등)을 넣어 재서
  자동 처리 96.1~100%, 오매칭 0건을 확인했다.
- 캡처 조건(해상도, 창모드, 정렬)을 8세트 91장으로 비교했다. 해상도는 1366이 일관되게 나았고(최대 21%p),
  창모드·정렬은 표본으로 단정할 수 없어 그렇게 기록했다.

개발·실측 기록 전체: [`docs/guild-score-ocr.md`](docs/guild-score-ocr.md)

See `CLAUDE.md` for development conventions and `docs/` for design decisions.

## Prerequisites

- **Python** 3.12+ with [`uv`](https://docs.astral.sh/uv/) installed
- **Node.js** 20+ with [`pnpm`](https://pnpm.io/) installed
- A **Nexon Open API key** (from your own Nexon Open API developer account) —
  required for any endpoint to actually return data
- **PostgreSQL** — optional for now. Nothing currently implemented reads from
  or writes to the database (it's wired up for future use via Alembic), so
  you only need this if you're working on something that touches `app/db`.

## Backend setup

```
cd backend
uv sync
```

Copy `.env.example` to `.env` and fill in your Nexon API key:

```
cp .env.example .env
```

```
# backend/.env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/maple
NEXON_API_KEY=your-nexon-api-key-here
```

### Run the backend

```
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

- API base: `http://localhost:8000/api/v1`
- Interactive docs: `http://localhost:8000/docs`

By default the backend only accepts cross-origin requests from
`http://localhost:5173` (see `cors_origins` in `app/core/config.py`) — that's
the frontend dev server's default port.

### Other backend commands

```
uv run pytest              # tests
uv run ruff check .        # lint
uv run ruff format .       # format
uv run mypy app            # type check
uv run alembic upgrade head  # apply DB migrations (only if you're touching app/db)
```

## Frontend setup

```
cd frontend
pnpm install
```

### Run the frontend

```
cd frontend
pnpm dev
```

Opens on `http://localhost:5173` and talks to the backend at
`http://localhost:8000` by default (see `src/lib/api-client.ts`; override with
a `VITE_API_BASE_URL` env var if the backend runs elsewhere).

The backend must be running for the frontend to show real data (character
search, notices, etc.).

### Other frontend commands

```
pnpm build                # production build
pnpm lint                 # oxlint
pnpm generate:api-types   # regenerate src/lib/api-types.ts from the backend's
                          # OpenAPI schema — requires the backend running on
                          # localhost:8000
```

## Streamlit dev console

A dev-only tool that calls the Nexon service functions directly (no HTTP
layer) with auto-generated input forms — useful for exercising an endpoint
without going through the frontend at all.

```
cd backend
uv run streamlit run tools/streamlit_app.py
```

Requires the same `backend/.env` setup as the main backend (specifically
`NEXON_API_KEY`).
