import httpx
import pytest
import respx

from app.services.nexon.client import NexonApiClient
from app.services.nexon.exceptions import NexonApiError, NexonRateLimitError


async def test_get_sends_api_key_header_and_drops_none_params() -> None:
    async with NexonApiClient(api_key="test-key", base_url="https://open.api.nexon.com") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            route = mock.get("/maplestory/v1/character/basic").mock(
                return_value=httpx.Response(200, json={"character_name": "test"})
            )

            result = await client.get(
                "/maplestory/v1/character/basic", {"ocid": "abc", "date": None}
            )

    assert result == {"character_name": "test"}
    request = route.calls.last.request
    assert request.headers["x-nxopen-api-key"] == "test-key"
    assert request.url.params == httpx.QueryParams({"ocid": "abc"})


async def test_get_raises_nexon_api_error_on_4xx() -> None:
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            mock.get("/maplestory/v1/character/basic").mock(
                return_value=httpx.Response(
                    403, json={"error": {"name": "FORBIDDEN", "message": "invalid key"}}
                )
            )

            with pytest.raises(NexonApiError) as exc_info:
                await client.get("/maplestory/v1/character/basic", {"ocid": "abc"})

    assert exc_info.value.status_code == 403
    assert exc_info.value.error_name == "FORBIDDEN"
    assert exc_info.value.error_message == "invalid key"


async def test_get_raises_rate_limit_error_on_429() -> None:
    async with NexonApiClient(api_key="test-key") as client:
        with respx.mock(base_url="https://open.api.nexon.com") as mock:
            mock.get("/maplestory/v1/character/basic").mock(
                return_value=httpx.Response(
                    429, json={"error": {"name": "TOO_MANY_REQUESTS", "message": "slow down"}}
                )
            )

            with pytest.raises(NexonRateLimitError):
                await client.get("/maplestory/v1/character/basic", {"ocid": "abc"})
