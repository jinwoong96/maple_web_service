import httpx
from httpx import AsyncClient
from respx import MockRouter


async def test_get_ocid_endpoint(api_client: AsyncClient, nexon_mock: MockRouter) -> None:
    nexon_mock.get("/maplestory/v1/id").mock(
        return_value=httpx.Response(200, json={"ocid": "abcd1234"})
    )

    response = await api_client.get(
        "/api/v1/characters/ocid", params={"character_name": "TestCharacter"}
    )

    assert response.status_code == 200
    assert response.json() == {"ocid": "abcd1234"}


async def test_get_character_basic_endpoint(
    api_client: AsyncClient, nexon_mock: MockRouter
) -> None:
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
    nexon_mock.get("/maplestory/v1/character/basic").mock(
        return_value=httpx.Response(200, json=payload)
    )

    response = await api_client.get("/api/v1/characters/abcd1234/basic")

    assert response.status_code == 200
    assert response.json()["character_name"] == "TestCharacter"


async def test_get_character_skill_endpoint_forwards_grade_param(
    api_client: AsyncClient, nexon_mock: MockRouter
) -> None:
    payload = {
        "date": "2023-12-21T00:00+09:00",
        "character_class": "히어로",
        "character_skill_grade": "4",
        "character_skill": [],
    }
    route = nexon_mock.get("/maplestory/v1/character/skill").mock(
        return_value=httpx.Response(200, json=payload)
    )

    response = await api_client.get(
        "/api/v1/characters/abcd1234/skill", params={"character_skill_grade": "4"}
    )

    assert response.status_code == 200
    assert route.calls.last.request.url.params["character_skill_grade"] == "4"


async def test_get_character_ring_skill_equipment_dispatches_by_date(
    api_client: AsyncClient, nexon_mock: MockRouter
) -> None:
    nexon_mock.get("/maplestory/v1/character/ring-exchange-skill-equipment").mock(
        return_value=httpx.Response(200, json={"date": None, "character_class": "히어로"})
    )

    response = await api_client.get(
        "/api/v1/characters/abcd1234/ring-skill-equipment", params={"date": "2026-01-01"}
    )

    assert response.status_code == 200
