"""Endpoint functions for the Nexon Open API "연무장 정보 조회" (BattlePractice) category.

Flow: ``get_battle_practice_replay_id`` (by ``ocid``) to list replay ids, then
the other three endpoints take a ``replay_id`` from that list.
"""

from app.services.nexon.client import NexonApiClient
from app.services.nexon.schemas.battle_practice import (
    BattlePracticeCharacterInfo,
    BattlePracticeResult,
    ReplayId,
    SkillTimeline,
)


async def get_battle_practice_replay_id(client: NexonApiClient, ocid: str) -> ReplayId:
    data = await client.get("/maplestory/v1/battle-practice/replay-id", {"ocid": ocid})
    return ReplayId.model_validate(data)


async def get_battle_practice_result(
    client: NexonApiClient, replay_id: str
) -> BattlePracticeResult:
    data = await client.get("/maplestory/v1/battle-practice/result", {"replay_id": replay_id})
    return BattlePracticeResult.model_validate(data)


async def get_battle_practice_skill_timeline(
    client: NexonApiClient, replay_id: str, page_no: int | None = None
) -> SkillTimeline:
    data = await client.get(
        "/maplestory/v1/battle-practice/skill-timeline",
        {"replay_id": replay_id, "page_no": str(page_no) if page_no is not None else None},
    )
    return SkillTimeline.model_validate(data)


async def get_battle_practice_character_info(
    client: NexonApiClient, replay_id: str
) -> BattlePracticeCharacterInfo:
    data = await client.get(
        "/maplestory/v1/battle-practice/character-info", {"replay_id": replay_id}
    )
    return BattlePracticeCharacterInfo.model_validate(data)
