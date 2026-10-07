from types import TracebackType
from typing import Any, Self

import httpx

from app.services.nexon.exceptions import NexonApiError, NexonRateLimitError

_ERROR_TYPES: dict[int, type[NexonApiError]] = {429: NexonRateLimitError}


class NexonApiClient:
    """Thin async wrapper around the Nexon Open API.

    Handles auth header injection, query-param cleanup, and error-envelope
    mapping so individual endpoint functions only need to declare a path,
    params, and a response model.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://open.api.nexon.com",
        timeout: float = 10.0,
    ) -> None:
        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout)
        self._api_key = api_key

    async def get(self, path: str, params: dict[str, str | None] | None = None) -> dict[str, Any]:
        query = {key: value for key, value in (params or {}).items() if value is not None}
        response = await self._client.get(
            path, params=query, headers={"x-nxopen-api-key": self._api_key}
        )
        if response.status_code >= 400:
            body = response.json() if response.content else {}
            error = body.get("error", {})
            error_cls = _ERROR_TYPES.get(response.status_code, NexonApiError)
            raise error_cls(
                response.status_code,
                error.get("name", "UNKNOWN"),
                error.get("message", response.text),
            )
        result: dict[str, Any] = response.json()
        return result

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()
