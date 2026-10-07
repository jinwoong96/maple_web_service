"""Endpoint functions for the Nexon Open API "유니온 정보 조회" (Union) category.

All endpoints take an ``ocid`` and an optional ``date`` (KST, ``YYYY-MM-DD``).
"""

from app.services.nexon.client import NexonApiClient
from app.services.nexon.schemas.union import (
    CharacterUnionChampion,
    UnionArtifact,
    UnionInfo,
    UnionRaider,
)


async def get_union(client: NexonApiClient, ocid: str, date: str | None = None) -> UnionInfo:
    data = await client.get("/maplestory/v1/user/union", {"ocid": ocid, "date": date})
    return UnionInfo.model_validate(data)


async def get_union_raider(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> UnionRaider:
    data = await client.get("/maplestory/v1/user/union-raider", {"ocid": ocid, "date": date})
    return UnionRaider.model_validate(data)


async def get_union_artifact(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> UnionArtifact:
    data = await client.get("/maplestory/v1/user/union-artifact", {"ocid": ocid, "date": date})
    return UnionArtifact.model_validate(data)


async def get_union_champion(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterUnionChampion:
    data = await client.get("/maplestory/v1/user/union-champion", {"ocid": ocid, "date": date})
    return CharacterUnionChampion.model_validate(data)
