"""Endpoint functions for the Nexon Open API "랭킹 정보 조회" (Ranking) category.

``date`` is required on every endpoint here (confirmed against the docs —
omitting it, or a stale value, gets a 400). Nexon also only keeps ranking
data for roughly the last 2 years. The other parameters are optional filters
on top of the ranking itself (Nexon defaults ``page`` to 1 and ``world_type``
to 0 when omitted). ``class_`` maps to the API's ``class`` query parameter (a
reserved word in Python).
"""

from app.services.nexon.client import NexonApiClient
from app.services.nexon.schemas.ranking import (
    AchievementRanking,
    DojangRanking,
    GuildRanking,
    OverallRanking,
    TheSeedRanking,
    UnionRanking,
)


async def get_ranking_overall(
    client: NexonApiClient,
    date: str,
    world_name: str | None = None,
    world_type: int | None = None,
    class_: str | None = None,
    ocid: str | None = None,
    page: int | None = None,
) -> OverallRanking:
    data = await client.get(
        "/maplestory/v1/ranking/overall",
        {
            "date": date,
            "world_name": world_name,
            "world_type": str(world_type) if world_type is not None else None,
            "class": class_,
            "ocid": ocid,
            "page": str(page) if page is not None else None,
        },
    )
    return OverallRanking.model_validate(data)


async def get_ranking_union(
    client: NexonApiClient,
    date: str,
    world_name: str | None = None,
    ocid: str | None = None,
    page: int | None = None,
) -> UnionRanking:
    data = await client.get(
        "/maplestory/v1/ranking/union",
        {
            "date": date,
            "world_name": world_name,
            "ocid": ocid,
            "page": str(page) if page is not None else None,
        },
    )
    return UnionRanking.model_validate(data)


async def get_ranking_guild(
    client: NexonApiClient,
    date: str,
    world_name: str | None = None,
    ranking_type: int | None = None,
    guild_name: str | None = None,
    page: int | None = None,
) -> GuildRanking:
    data = await client.get(
        "/maplestory/v1/ranking/guild",
        {
            "date": date,
            "world_name": world_name,
            "ranking_type": str(ranking_type) if ranking_type is not None else None,
            "guild_name": guild_name,
            "page": str(page) if page is not None else None,
        },
    )
    return GuildRanking.model_validate(data)


async def get_ranking_dojang(
    client: NexonApiClient,
    date: str,
    world_name: str | None = None,
    difficulty: int | None = None,
    class_: str | None = None,
    ocid: str | None = None,
    page: int | None = None,
) -> DojangRanking:
    data = await client.get(
        "/maplestory/v1/ranking/dojang",
        {
            "date": date,
            "world_name": world_name,
            "difficulty": str(difficulty) if difficulty is not None else None,
            "class": class_,
            "ocid": ocid,
            "page": str(page) if page is not None else None,
        },
    )
    return DojangRanking.model_validate(data)


async def get_ranking_theseed(
    client: NexonApiClient,
    date: str,
    world_name: str | None = None,
    ocid: str | None = None,
    page: int | None = None,
) -> TheSeedRanking:
    data = await client.get(
        "/maplestory/v1/ranking/theseed",
        {
            "date": date,
            "world_name": world_name,
            "ocid": ocid,
            "page": str(page) if page is not None else None,
        },
    )
    return TheSeedRanking.model_validate(data)


async def get_ranking_achievement(
    client: NexonApiClient,
    date: str,
    world_name: str | None = None,
    ocid: str | None = None,
    page: int | None = None,
) -> AchievementRanking:
    data = await client.get(
        "/maplestory/v1/ranking/achievement",
        {
            "date": date,
            "world_name": world_name,
            "ocid": ocid,
            "page": str(page) if page is not None else None,
        },
    )
    return AchievementRanking.model_validate(data)
