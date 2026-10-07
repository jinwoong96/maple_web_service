# Nexon API Caching Strategy

**구현 완료 (2026-09-27).** 아래는 제안 당시의 설계와, 만들면서 달라진
것이다.

| 무엇 | 어디 |
| --- | --- |
| 표 | `nexon_response_cache` (`app/models/nexon_cache.py`) |
| 읽고-없으면-채우기 | `app/services/nexon/cache.py`의 `cached_response` |
| 쓰는 곳 | `app/services/nexon/notice.py`의 목록 넷 |
| TTL | `settings.nexon_cache_ttl_seconds` (기본 300초) |

**설계에서 달라진 것 둘.**

- TTL 기본값을 1분이 아니라 **5분**으로 잡았다. 아래 "Assessment"가 이미
  5~15분이면 사람 눈에 티가 안 난다고 적어 뒀고, 어차피 설정이라 돌려볼 수
  있다.
- **넥슨이 실패하면 늙은 것이라도 내준다.** 제안에는 없던 것인데, 담아둔 것이
  있는데도 홈 화면을 통째로 비우는 건 손해다. 담아둔 것이 아예 없을 때만
  오류를 그대로 올린다.

만들면서 하나 걸렸다. `_store`가 ORM을 거치지 않고 한 문장으로 넣기 때문에,
세션이 들고 있던 옛 객체가 그대로 돌아온다(`expire_on_commit=False`라 커밋해도
스스로 새로 읽지 않는다). `populate_existing=True`가 필요하다 —
`services/item_level.py`가 같은 이유로 같은 옵션을 쓴다. 시험이 잡았다.

**실측 (2026-09-27, 로컬)**: `/health`가 207ms인 환경이라 그게 고정 비용이다.
공지 목록은 담아둔 것을 내줄 때 **+8ms**, 넥슨을 탈 때 **+60~190ms**. 같은
엔드포인트를 네 번 불러도 `fetched_at`이 그대로였다 — 넥슨을 한 번만 불렀다는
뜻이다.

---

## 제안 당시 기록

## Problem

The whole service shares a single Nexon Open API key (see `CLAUDE.md`'s "키
관리" note and `REVIEW_NOTES_HISTORY.md`). Right now, every visitor to the home
screen triggers two live Nexon calls (general notice list, event notice list)
on every page load. That scales with visitor traffic, not with how often the
underlying data actually changes — as usage grows, this is the most likely
place to first hit Nexon's per-key rate limit, since notices are the one thing
every visitor's browser fetches unconditionally.

## Proposed change

Read-through cache backed by Postgres:

1. On request, read the last cached response from the DB first.
2. If it's younger than a TTL (starting point: 1 minute), serve it directly —
   no Nexon call.
3. If it's stale (or missing), call Nexon, overwrite the cached row, then
   serve the fresh response.

## Assessment

Agreed — this is a standard cache-aside/TTL pattern and a good fit here
specifically because all traffic shares one Nexon key: without it, Nexon call
volume for notices is unbounded by our own traffic, not by how often notices
actually change.

Notices/events change on the order of hours in practice (a handful of times a
day), not seconds. A 1-minute TTL is a safe starting point — it already caps
Nexon calls at roughly 1/minute per endpoint regardless of visitor count — but
a longer TTL (5–15 min) would cut calls further with no perceptible staleness
to users. Recommend keeping the TTL as a config value (`app/core/config.py`)
rather than a hardcoded constant, so it can be tuned without a redeploy once
there's real traffic data to look at.

This doesn't need new infrastructure: `app/db/session.py`, `app/db/base.py`,
and an (currently empty) `alembic/versions/` are already scaffolded.

## Where it fits in the existing layering

The cache-or-refresh decision belongs inside `services/nexon/notice.py` (or a
small shared caching helper it calls) — per `CLAUDE.md`'s layering rules, that
is where business logic/orchestration lives. `api/v1/notice.py` stays an
unchanged, pure passthrough; it shouldn't know or care that a cache exists
underneath.

## Design sketch

One generic cache table, not one per endpoint, so the same mechanism extends
to other "shared/global, no per-user parameters" endpoints later without a
schema change each time:

```
nexon_response_cache
  cache_key   text primary key      -- e.g. "notice:general", "notice:events"
  payload     jsonb not null        -- last successful Nexon response, verbatim
  fetched_at  timestamptz not null
```

This applies cleanly to the *parameterless* Notice endpoints (general /
update / event / cashshop lists) — one fixed cache key per endpoint. It does
**not** directly extend to endpoints keyed by `ocid` / `oguild_id` / `date`
(character, guild, union, ranking): those would need a composite cache key,
and the tradeoff is different — caching there mostly saves repeat lookups of
the *same* target rather than capping total Nexon traffic under load. Worth a
separate design pass if/when it becomes relevant; not bundled into this one.

## Known limitation (accepted for a first version)

No lock around the refresh step: if the TTL expires while multiple requests
arrive at once, more than one could trigger a concurrent Nexon refresh (a
cache stampede). Low-impact for Notice-list traffic specifically; if it
becomes a real issue later, tighten with a per-key advisory lock or a
"serve stale while refreshing in the background" approach.
