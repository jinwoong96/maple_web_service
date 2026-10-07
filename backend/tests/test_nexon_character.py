import httpx
import respx

from app.services.nexon.character import (
    get_character_basic,
    get_character_ring_skill_equipment,
    get_character_skill,
    get_ocid,
)
from app.services.nexon.client import NexonApiClient


async def test_get_ocid_returns_ocid_string() -> None:
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            mock.get("/maplestory/v1/id").mock(
                return_value=httpx.Response(200, json={"ocid": "abcd1234"})
            )

            ocid = await get_ocid(client, "TestCharacter")

    assert ocid == "abcd1234"


async def test_get_character_basic_parses_response() -> None:
    payload = {
        "date": "2023-12-21T00:00+09:00",
        "character_name": "TestCharacter",
        "world_name": "스카니아",
        "character_gender": "남",
        "character_class": "히어로",
        "character_class_level": "4",
        "character_level": 250,
        "character_exp": 12345,
        "character_exp_rate": "12.34",
        "character_guild_name": "TestGuild",
        "character_image": "https://example.com/image.png",
        "character_date_create": "2010-01-01T00:00+09:00",
        "access_flag": "true",
        "liberation_quest_clear": "3",
    }

    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            mock.get("/maplestory/v1/character/basic").mock(
                return_value=httpx.Response(200, json=payload)
            )

            basic = await get_character_basic(client, ocid="abcd1234")

    assert basic.character_name == "TestCharacter"
    assert basic.character_level == 250


async def test_get_character_skill_sends_character_skill_grade_param() -> None:
    payload = {
        "date": "2023-12-21T00:00+09:00",
        "character_class": "히어로",
        "character_skill_grade": "4",
        "character_skill": [],
    }

    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            route = mock.get("/maplestory/v1/character/skill").mock(
                return_value=httpx.Response(200, json=payload)
            )

            skill = await get_character_skill(client, ocid="abcd1234", character_skill_grade="4")

    assert skill.character_skill_grade == "4"
    request = route.calls.last.request
    assert request.url.params["character_skill_grade"] == "4"


async def test_get_character_skill_handles_null_grade_for_empty_tier() -> None:
    """Nexon returns character_skill_grade: null (with an empty
    character_skill[]) for a grade this character has no skills in, e.g.
    the 1.5/2.5 hidden-skill tiers on a class without one — confirmed live
    via 다섯별(메카닉). This used to raise a pydantic ValidationError."""
    payload: dict[str, object] = {
        "date": None,
        "character_class": "메카닉",
        "character_skill_grade": None,
        "character_skill": [],
    }

    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            mock.get("/maplestory/v1/character/skill").mock(
                return_value=httpx.Response(200, json=payload)
            )

            skill = await get_character_skill(client, ocid="abcd1234", character_skill_grade="1.5")

    assert skill.character_skill_grade is None
    assert skill.character_skill == []


async def test_ring_skill_equipment_uses_exchange_endpoint_before_cutover() -> None:
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            route = mock.get("/maplestory/v1/character/ring-exchange-skill-equipment").mock(
                return_value=httpx.Response(200, json={"character_class": "히어로"})
            )

            result = await get_character_ring_skill_equipment(
                client, ocid="abcd1234", date="2026-03-18"
            )

    assert route.called
    assert type(result).__name__ == "RingExchangeSkillEquipment"


async def test_ring_skill_equipment_uses_reserve_endpoint_on_and_after_cutover() -> None:
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            route = mock.get("/maplestory/v1/character/ring-reserve-skill-equipment").mock(
                return_value=httpx.Response(200, json={"character_class": "히어로"})
            )

            result = await get_character_ring_skill_equipment(
                client, ocid="abcd1234", date="2026-03-19"
            )

    assert route.called
    assert type(result).__name__ == "RingReserveSkillEquipment"


async def test_ring_skill_equipment_defaults_to_todays_kst_date() -> None:
    # "today" in this test environment's clock is well after the 2026-03-19
    # cutover, so omitting `date` should hit the reserve endpoint.
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            route = mock.get("/maplestory/v1/character/ring-reserve-skill-equipment").mock(
                return_value=httpx.Response(200, json={"character_class": "히어로"})
            )

            await get_character_ring_skill_equipment(client, ocid="abcd1234")

    assert route.called
