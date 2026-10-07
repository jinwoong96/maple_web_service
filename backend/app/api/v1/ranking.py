from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.services.nexon import ranking as ranking_service
from app.services.nexon.client import NexonApiClient
from app.services.nexon.deps import get_nexon_client
from app.services.nexon.schemas.ranking import (
    AchievementRanking,
    DojangRanking,
    GuildRanking,
    OverallRanking,
    TheSeedRanking,
    UnionRanking,
)

router = APIRouter(prefix="/rankings", tags=["ranking"])

ClientDep = Annotated[NexonApiClient, Depends(get_nexon_client)]
DateQuery = Annotated[
    str, Query(description="KST 날짜 (YYYY-MM-DD). 필수, 최근 2년 데이터만 조회 가능")
]
WorldNameQuery = Annotated[str | None, Query()]
OcidQuery = Annotated[str | None, Query()]
PageQuery = Annotated[int | None, Query()]


@router.get("/overall")
async def get_ranking_overall(
    date: DateQuery,
    client: ClientDep,
    world_name: WorldNameQuery = None,
    world_type: Annotated[int | None, Query()] = None,
    class_: Annotated[str | None, Query(alias="class")] = None,
    ocid: OcidQuery = None,
    page: PageQuery = None,
) -> OverallRanking:
    return await ranking_service.get_ranking_overall(
        client, date, world_name, world_type, class_, ocid, page
    )


@router.get("/union")
async def get_ranking_union(
    date: DateQuery,
    client: ClientDep,
    world_name: WorldNameQuery = None,
    ocid: OcidQuery = None,
    page: PageQuery = None,
) -> UnionRanking:
    return await ranking_service.get_ranking_union(client, date, world_name, ocid, page)


@router.get("/guild")
async def get_ranking_guild(
    date: DateQuery,
    client: ClientDep,
    world_name: WorldNameQuery = None,
    ranking_type: Annotated[int | None, Query()] = None,
    guild_name: Annotated[str | None, Query()] = None,
    page: PageQuery = None,
) -> GuildRanking:
    return await ranking_service.get_ranking_guild(
        client, date, world_name, ranking_type, guild_name, page
    )


@router.get("/dojang")
async def get_ranking_dojang(
    date: DateQuery,
    client: ClientDep,
    world_name: WorldNameQuery = None,
    difficulty: Annotated[int | None, Query()] = None,
    class_: Annotated[str | None, Query(alias="class")] = None,
    ocid: OcidQuery = None,
    page: PageQuery = None,
) -> DojangRanking:
    return await ranking_service.get_ranking_dojang(
        client, date, world_name, difficulty, class_, ocid, page
    )


@router.get("/theseed")
async def get_ranking_theseed(
    date: DateQuery,
    client: ClientDep,
    world_name: WorldNameQuery = None,
    ocid: OcidQuery = None,
    page: PageQuery = None,
) -> TheSeedRanking:
    return await ranking_service.get_ranking_theseed(client, date, world_name, ocid, page)


@router.get("/achievement")
async def get_ranking_achievement(
    date: DateQuery,
    client: ClientDep,
    world_name: WorldNameQuery = None,
    ocid: OcidQuery = None,
    page: PageQuery = None,
) -> AchievementRanking:
    return await ranking_service.get_ranking_achievement(client, date, world_name, ocid, page)
