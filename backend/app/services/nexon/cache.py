"""넥슨 응답을 잠시 담아 두고 다시 쓴다.

**서비스 전체가 넥슨 키 하나를 같이 쓴다.** 그래서 넥슨 호출 수가 자료가
바뀌는 빈도가 아니라 우리 방문자 수를 따라 늘어난다. 홈 화면은 누구나 열자마자
공지 목록 네 개를 부르므로, 키 한도에 제일 먼저 닿을 자리가 거기다.

읽고-없으면-채우는 흔한 꼴이다. 담아둔 것이 TTL보다 젊으면 그대로 내주고,
늙었으면 넥슨을 부른 뒤 덮어쓴다.

**넥슨이 실패하면 늙은 것이라도 내준다.** 공지 목록은 5분 늦어도 아무 일이
없지만, 홈 화면이 통째로 비면 눈에 띈다. 담아둔 것이 아예 없을 때만 오류를
그대로 올린다.

한꺼번에 여러 요청이 TTL 만료를 넘으면 **넥슨을 여러 번 부를 수 있다.** 잠금은
두지 않았다 — 공지 목록 정도에서는 손해가 작고, 문제가 되면 그때 자문 잠금이나
"늙은 것을 내주면서 뒤에서 갱신"으로 조인다.
"""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.nexon_cache import NexonResponseCache


async def cached_response(
    db: AsyncSession,
    cache_key: str,
    fetch: Callable[[], Awaitable[dict[str, Any]]],
    *,
    ttl_seconds: int | None = None,
) -> dict[str, Any]:
    """담아둔 응답을 내주거나, 늙었으면 다시 받아 담고 내준다."""
    ttl = timedelta(
        seconds=ttl_seconds if ttl_seconds is not None else settings.nexon_cache_ttl_seconds
    )
    # `populate_existing`이 있어야 한다. 아래 `_store`가 ORM을 거치지 않고
    # 한 문장으로 넣기 때문에, 세션이 들고 있던 옛 객체가 그대로 돌아온다
    # (`expire_on_commit=False`라 커밋해도 스스로 새로 읽지 않는다).
    # `services/item_level.py`가 같은 이유로 같은 옵션을 쓴다.
    row = await db.get(NexonResponseCache, cache_key, populate_existing=True)
    if row is not None and datetime.now(UTC) - row.fetched_at < ttl:
        return row.payload

    try:
        payload = await fetch()
    except Exception:
        # 넥슨이 실패했다. 늙었어도 있으면 그걸 내준다.
        if row is not None:
            return row.payload
        raise

    await _store(db, cache_key, payload)
    return payload


async def _store(db: AsyncSession, cache_key: str, payload: dict[str, Any]) -> None:
    # ORM으로 넣으면 같은 열쇠가 동시에 들어올 때 부딪힌다. 한 문장으로 넣거나
    # 덮어쓰는 편이 간단하다.
    await db.execute(
        insert(NexonResponseCache)
        .values(cache_key=cache_key, payload=payload, fetched_at=datetime.now(UTC))
        .on_conflict_do_update(
            index_elements=[NexonResponseCache.cache_key],
            set_={"payload": payload, "fetched_at": datetime.now(UTC)},
        )
    )
    await db.commit()


async def peek(db: AsyncSession, cache_key: str) -> NexonResponseCache | None:
    """담아둔 줄을 그대로 본다. 시험에서 쓴다."""
    result = await db.execute(
        select(NexonResponseCache)
        .where(NexonResponseCache.cache_key == cache_key)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one_or_none()
