from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.services.nexon import battle_practice as battle_practice_service
from app.services.nexon.client import NexonApiClient
from app.services.nexon.deps import get_nexon_client
from app.services.nexon.schemas.battle_practice import (
    BattlePracticeCharacterInfo,
    BattlePracticeResult,
    ReplayId,
    SkillTimeline,
)

router = APIRouter(prefix="/battle-practice", tags=["battle-practice"])

ClientDep = Annotated[NexonApiClient, Depends(get_nexon_client)]


@router.get("/replay-ids")
async def get_battle_practice_replay_id(ocid: str, client: ClientDep) -> ReplayId:
    return await battle_practice_service.get_battle_practice_replay_id(client, ocid)


@router.get("/{replay_id}/result")
async def get_battle_practice_result(replay_id: str, client: ClientDep) -> BattlePracticeResult:
    return await battle_practice_service.get_battle_practice_result(client, replay_id)


@router.get("/{replay_id}/skill-timeline")
async def get_battle_practice_skill_timeline(
    replay_id: str,
    client: ClientDep,
    page_no: Annotated[int | None, Query()] = None,
) -> SkillTimeline:
    return await battle_practice_service.get_battle_practice_skill_timeline(
        client, replay_id, page_no
    )


@router.get("/{replay_id}/character-info")
async def get_battle_practice_character_info(
    replay_id: str, client: ClientDep
) -> BattlePracticeCharacterInfo:
    return await battle_practice_service.get_battle_practice_character_info(client, replay_id)
