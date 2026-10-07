from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.schemas.common import OguildIdResponse
from app.services.nexon import guild as guild_service
from app.services.nexon.client import NexonApiClient
from app.services.nexon.deps import get_nexon_client
from app.services.nexon.schemas.guild import GuildBasic

router = APIRouter(prefix="/guilds", tags=["guild"])

DateQuery = Annotated[str | None, Query(description="KST 날짜 (YYYY-MM-DD), 생략 시 최신 데이터")]
ClientDep = Annotated[NexonApiClient, Depends(get_nexon_client)]


@router.get("/oguild-id")
async def get_oguild_id(guild_name: str, world_name: str, client: ClientDep) -> OguildIdResponse:
    oguild_id = await guild_service.get_oguild_id(client, guild_name, world_name)
    return OguildIdResponse(oguild_id=oguild_id)


@router.get("/{oguild_id}/basic")
async def get_guild_basic(oguild_id: str, client: ClientDep, date: DateQuery = None) -> GuildBasic:
    return await guild_service.get_guild_basic(client, oguild_id, date)
