"""넥슨 응답 담아 두기.

담아 둔 것을 다시 쓰는지, 늙으면 다시 받는지, 넥슨이 죽으면 늙은 것이라도
내주는지를 본다. 마지막 것이 특히 중요하다 — 담아 두는 목적이 호출을 줄이는
것이지만, 덤으로 넥슨이 잠깐 죽어도 홈 화면이 비지 않게 해준다.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
import respx
from httpx import AsyncClient
from respx import MockRouter
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.nexon_cache import NexonResponseCache
from app.services.nexon.cache import cached_response, peek

KEY = "test:cache"


async def _clean(db: AsyncSession) -> None:
    await db.execute(delete(NexonResponseCache).where(NexonResponseCache.cache_key == KEY))
    await db.commit()


async def test_second_call_does_not_hit_nexon(db_session: AsyncSession) -> None:
    await _clean(db_session)
    calls = 0

    async def fetch() -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return {"value": calls}

    try:
        first = await cached_response(db_session, KEY, fetch)
        second = await cached_response(db_session, KEY, fetch)
        assert first == second == {"value": 1}
        assert calls == 1
    finally:
        await _clean(db_session)


async def test_stale_row_is_refreshed(db_session: AsyncSession) -> None:
    await _clean(db_session)

    async def fetch() -> dict[str, Any]:
        return {"value": "new"}

    try:
        await cached_response(db_session, KEY, lambda: _value("old"))
        row = await peek(db_session, KEY)
        assert row is not None
        # TTL을 0으로 두면 담아둔 순간 이미 늙은 것이다.
        assert await cached_response(db_session, KEY, fetch, ttl_seconds=0) == {"value": "new"}
        fresh = await peek(db_session, KEY)
        assert fresh is not None
        assert fresh.payload == {"value": "new"}
    finally:
        await _clean(db_session)


async def test_stale_row_is_served_when_nexon_fails(db_session: AsyncSession) -> None:
    """넥슨이 죽어도 담아둔 것이 있으면 그걸 내준다."""
    await _clean(db_session)

    async def boom() -> dict[str, Any]:
        raise RuntimeError("넥슨이 죽었다")

    try:
        await cached_response(db_session, KEY, lambda: _value("old"))
        assert await cached_response(db_session, KEY, boom, ttl_seconds=0) == {"value": "old"}
    finally:
        await _clean(db_session)


async def test_failure_without_cache_raises(db_session: AsyncSession) -> None:
    """담아둔 것이 아예 없으면 숨기지 않는다 — 빈 화면보다 오류가 낫다."""
    await _clean(db_session)

    async def boom() -> dict[str, Any]:
        raise RuntimeError("넥슨이 죽었다")

    with pytest.raises(RuntimeError):
        await cached_response(db_session, KEY, boom)


async def test_notice_endpoint_calls_nexon_once(
    api_client: AsyncClient, nexon_mock: MockRouter, clean_nexon_cache: None
) -> None:
    """두 번 열어도 넥슨은 한 번만 부른다 — 이게 이 기능의 전부다."""
    route = nexon_mock.get("/maplestory/v1/notice").mock(
        return_value=httpx.Response(200, json={"notice": []})
    )

    assert (await api_client.get("/api/v1/notices/general")).status_code == 200
    assert (await api_client.get("/api/v1/notices/general")).status_code == 200

    assert route.call_count == 1


async def _value(value: str) -> dict[str, Any]:
    return {"value": value}


async def test_expired_row_is_not_served(db_session: AsyncSession) -> None:
    """TTL을 넘긴 줄은 다시 받는다. 시각을 직접 손봐서 확인한다."""
    await _clean(db_session)
    try:
        await cached_response(db_session, KEY, lambda: _value("old"))
        row = await peek(db_session, KEY)
        assert row is not None
        row.fetched_at = datetime.now(UTC) - timedelta(hours=1)
        await db_session.commit()

        with respx.mock:
            assert await cached_response(
                db_session, KEY, lambda: _value("new"), ttl_seconds=60
            ) == {"value": "new"}
    finally:
        await _clean(db_session)
