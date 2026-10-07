from collections.abc import AsyncIterator, Iterator

import pytest
import respx
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory, get_db
from app.main import app
from app.models.nexon_cache import NexonResponseCache
from app.services.nexon.client import NexonApiClient
from app.services.nexon.deps import get_nexon_client


@pytest.fixture
async def api_client() -> AsyncIterator[AsyncClient]:
    async def _override_get_nexon_client() -> AsyncIterator[NexonApiClient]:
        async with NexonApiClient(api_key="test-key") as client:
            yield client

    async def _override_get_db() -> AsyncIterator[AsyncSession]:
        async with async_session_factory() as session:
            yield session

    app.dependency_overrides[get_nexon_client] = _override_get_nexon_client
    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """Real local dev Postgres — this repo has no test-DB/testcontainers
    setup yet (`item_level_reference` is the first DB-backed feature), so
    tests run against the same database `alembic upgrade head` targets.
    Each test using this fixture is responsible for cleaning up its own
    rows (see `test_item_level.py`)."""
    async with async_session_factory() as session:
        yield session


@pytest.fixture
async def clean_nexon_cache() -> AsyncIterator[None]:
    """담아둔 넥슨 응답을 비운다.

    공지 목록은 담아 두고 다시 쓰므로(`services/nexon/cache.py`), 앞 시험이
    남긴 줄이 있으면 넥슨을 아예 안 부른다. 그러면 "이 요청이 넥슨을 이렇게
    불렀다"는 시험이 순서에 따라 붙었다 떨어졌다 한다.
    """
    async with async_session_factory() as session:
        await session.execute(delete(NexonResponseCache))
        await session.commit()
    yield


@pytest.fixture
def nexon_mock() -> Iterator[respx.MockRouter]:
    with respx.mock(base_url="https://open.api.nexon.com") as mock:
        yield mock
