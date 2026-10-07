import httpx
from httpx import AsyncClient
from respx import MockRouter


async def test_nexon_api_error_is_translated_to_unified_json_shape(
    api_client: AsyncClient, nexon_mock: MockRouter
) -> None:
    nexon_mock.get("/maplestory/v1/character/basic").mock(
        return_value=httpx.Response(
            400, json={"error": {"name": "OPENAPI00004", "message": "Please input valid parameter"}}
        )
    )

    response = await api_client.get("/api/v1/characters/abcd1234/basic")

    assert response.status_code == 400
    assert response.json() == {
        "error": {"code": "OPENAPI00004", "message": "Please input valid parameter"}
    }


async def test_nexon_rate_limit_error_keeps_429_status(
    api_client: AsyncClient, nexon_mock: MockRouter
) -> None:
    nexon_mock.get("/maplestory/v1/character/basic").mock(
        return_value=httpx.Response(
            429, json={"error": {"name": "OPENAPI00009", "message": "Too many requests"}}
        )
    )

    response = await api_client.get("/api/v1/characters/abcd1234/basic")

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "OPENAPI00009"
