from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.services.nexon import union as union_service
from app.services.nexon.client import NexonApiClient
from app.services.nexon.deps import get_nexon_client
from app.services.nexon.schemas.union import (
    CharacterUnionChampion,
    UnionArtifact,
    UnionInfo,
    UnionRaider,
)

router = APIRouter(prefix="/unions", tags=["union"])

DateQuery = Annotated[str | None, Query(description="KST 날짜 (YYYY-MM-DD), 생략 시 최신 데이터")]
ClientDep = Annotated[NexonApiClient, Depends(get_nexon_client)]


@router.get("/{ocid}")
async def get_union(ocid: str, client: ClientDep, date: DateQuery = None) -> UnionInfo:
    return await union_service.get_union(client, ocid, date)


@router.get("/{ocid}/raider")
async def get_union_raider(ocid: str, client: ClientDep, date: DateQuery = None) -> UnionRaider:
    return await union_service.get_union_raider(client, ocid, date)


@router.get("/{ocid}/artifact")
async def get_union_artifact(ocid: str, client: ClientDep, date: DateQuery = None) -> UnionArtifact:
    return await union_service.get_union_artifact(client, ocid, date)


@router.get("/{ocid}/champion")
async def get_union_champion(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterUnionChampion:
    return await union_service.get_union_champion(client, ocid, date)
