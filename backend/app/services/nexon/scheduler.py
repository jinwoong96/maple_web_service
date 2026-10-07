"""Endpoint function for the Nexon Open API "스케줄러 정보" (Scheduler) category.

``ocid`` must belong to the same account as the API key being used — Nexon
restricts this endpoint to the key owner's own characters.
"""

from app.services.nexon.client import NexonApiClient
from app.services.nexon.schemas.scheduler import CharacterStateResponse


async def get_scheduler_character_state(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterStateResponse:
    data = await client.get(
        "/maplestory/v1/scheduler/character-state", {"ocid": ocid, "date": date}
    )
    return CharacterStateResponse.model_validate(data)
