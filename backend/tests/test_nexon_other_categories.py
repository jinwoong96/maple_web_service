import httpx
import respx
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.nexon.battle_practice import get_battle_practice_replay_id
from app.services.nexon.client import NexonApiClient
from app.services.nexon.guild import get_guild_basic, get_oguild_id
from app.services.nexon.notice import get_notice_list
from app.services.nexon.probability import get_account_ouid, get_starforce_history
from app.services.nexon.ranking import get_ranking_guild
from app.services.nexon.scheduler import get_scheduler_character_state
from app.services.nexon.union import get_union


async def test_get_union_parses_response() -> None:
    payload = {
        "date": "2023-12-21T00:00+09:00",
        "union_level": 8000,
        "union_grade": "그랜드 마스터 유니온",
        "union_artifact_level": 30,
        "union_artifact_exp": 100,
        "union_artifact_point": 500,
    }
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            mock.get("/maplestory/v1/user/union").mock(
                return_value=httpx.Response(200, json=payload)
            )
            union = await get_union(client, ocid="abcd1234")

    assert union.union_level == 8000


async def test_get_oguild_id_and_guild_basic() -> None:
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            mock.get("/maplestory/v1/guild/id").mock(
                return_value=httpx.Response(200, json={"oguild_id": "guild123"})
            )
            oguild_id = await get_oguild_id(client, guild_name="테스트길드", world_name="스카니아")

            mock.get("/maplestory/v1/guild/basic").mock(
                return_value=httpx.Response(
                    200,
                    json={
                        "world_name": "스카니아",
                        "guild_name": "테스트길드",
                        "guild_level": 30,
                        "guild_fame": 1000,
                        "guild_point": 500,
                        "guild_master_name": "마스터",
                        "guild_member_count": 50,
                        "guild_member": ["마스터", "멤버1"],
                    },
                )
            )
            basic = await get_guild_basic(client, oguild_id=oguild_id)

    assert oguild_id == "guild123"
    assert basic.guild_member_count == 50
    assert basic.guild_member == ["마스터", "멤버1"]


async def test_get_battle_practice_replay_id() -> None:
    payload = {
        "replay_list": [
            {"period_no": 1, "register_date": "2023-12-21T00:00+09:00", "replay_id": "r1"}
        ]
    }
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            mock.get("/maplestory/v1/battle-practice/replay-id").mock(
                return_value=httpx.Response(200, json=payload)
            )
            replay = await get_battle_practice_replay_id(client, ocid="abcd1234")

    assert replay.replay_list[0].replay_id == "r1"


async def test_get_account_ouid_and_starforce_history_params() -> None:
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            mock.get("/maplestory/v1/ouid").mock(
                return_value=httpx.Response(200, json={"ouid": "ouid123"})
            )
            ouid = await get_account_ouid(client)

            route = mock.get("/maplestory/v1/history/starforce").mock(
                return_value=httpx.Response(
                    200, json={"count": 0, "next_cursor": None, "starforce_history": []}
                )
            )
            history = await get_starforce_history(client, count=10, date="2023-12-27")

    assert ouid == "ouid123"
    assert history.count == 0
    request = route.calls.last.request
    assert request.url.params["count"] == "10"
    assert request.url.params["date"] == "2023-12-27"
    assert "cursor" not in request.url.params


async def test_get_scheduler_character_state_restricted_to_own_ocid() -> None:
    payload = {
        "character_name": "TestCharacter",
        "world_name": "스카니아",
        "character_level": 250,
        "character_class": "히어로",
        "daily_contents": [],
        "weekly_contents": [],
        "boss_contents": [],
    }
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            mock.get("/maplestory/v1/scheduler/character-state").mock(
                return_value=httpx.Response(200, json=payload)
            )
            state = await get_scheduler_character_state(client, ocid="abcd1234")

    assert state.character_name == "TestCharacter"


async def test_get_ranking_guild_sends_expected_params() -> None:
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            route = mock.get("/maplestory/v1/ranking/guild").mock(
                return_value=httpx.Response(200, json={"ranking": []})
            )
            await get_ranking_guild(
                client, date="2026-08-29", world_name="스카니아", ranking_type=0, page=1
            )

    request = route.calls.last.request
    assert request.url.params["date"] == "2026-08-29"
    assert request.url.params["world_name"] == "스카니아"
    assert request.url.params["ranking_type"] == "0"
    assert request.url.params["page"] == "1"


async def test_get_notice_list_no_params(db_session: AsyncSession, clean_nexon_cache: None) -> None:
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            route = mock.get("/maplestory/v1/notice").mock(
                return_value=httpx.Response(
                    200,
                    json={
                        "notice": [
                            {
                                "title": "공지",
                                "url": "https://example.com",
                                "notice_id": 1,
                                "date": "2023-12-21T00:00+09:00",
                            }
                        ]
                    },
                )
            )
            notices = await get_notice_list(client, db_session)

    assert notices.notice[0].notice_id == 1
    assert route.calls.last.request.url.params == httpx.QueryParams({})
