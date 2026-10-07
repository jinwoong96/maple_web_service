"""Endpoint functions for the Nexon Open API "확률 정보 조회" (Probability) category.

``get_account_ouid`` takes no target — it returns the account identifier for
whichever API key is used (a "personal" endpoint, like ``character/list``).
The three history endpoints return data for that same account and require
``date`` and/or ``cursor`` (at least one of the two, per Nexon's docs) plus a
page ``count`` (10-1000).
"""

from app.services.nexon.client import NexonApiClient
from app.services.nexon.schemas.probability import (
    CubeHistory,
    PotentialHistory,
    StarforceHistory,
)


async def get_account_ouid(client: NexonApiClient) -> str:
    data = await client.get("/maplestory/v1/ouid")
    ouid: str = data["ouid"]
    return ouid


async def get_starforce_history(
    client: NexonApiClient,
    count: int,
    date: str | None = None,
    cursor: str | None = None,
) -> StarforceHistory:
    data = await client.get(
        "/maplestory/v1/history/starforce",
        {"count": str(count), "date": date, "cursor": cursor},
    )
    return StarforceHistory.model_validate(data)


async def get_potential_history(
    client: NexonApiClient,
    count: int,
    date: str | None = None,
    cursor: str | None = None,
) -> PotentialHistory:
    data = await client.get(
        "/maplestory/v1/history/potential",
        {"count": str(count), "date": date, "cursor": cursor},
    )
    return PotentialHistory.model_validate(data)


async def get_cube_history(
    client: NexonApiClient,
    count: int,
    date: str | None = None,
    cursor: str | None = None,
) -> CubeHistory:
    data = await client.get(
        "/maplestory/v1/history/cube",
        {"count": str(count), "date": date, "cursor": cursor},
    )
    return CubeHistory.model_validate(data)
