"""Endpoint functions for the Nexon Open API "길드 정보 조회" (Guild) category."""

from app.services.nexon.client import NexonApiClient
from app.services.nexon.exceptions import NexonApiError
from app.services.nexon.schemas.guild import GuildBasic


async def get_oguild_id(client: NexonApiClient, guild_name: str, world_name: str) -> str:
    """길드명·월드명으로 식별자를 찾는다.

    **없는 길드면 넥슨이 200에 `oguild_id: null`을 준다.** 오류가 아니라
    "그런 길드 없음"이라는 답이다. 그대로 흘려보내면 응답 스키마에서
    터져서(`oguild_id`는 문자열이다) 500이 나가고, 브라우저에는 CORS 헤더가
    없는 응답이 도착해 `Failed to fetch`로 보인다 — 원인을 짐작할 수 없는
    형태가 된다. 그래서 여기서 404로 바꾼다.
    """
    data = await client.get(
        "/maplestory/v1/guild/id", {"guild_name": guild_name, "world_name": world_name}
    )
    oguild_id = data.get("oguild_id")
    if not oguild_id:
        raise NexonApiError(
            404, "OPENAPI00004", f"그런 길드를 찾을 수 없습니다: {world_name} {guild_name}"
        )
    return str(oguild_id)


async def get_guild_basic(
    client: NexonApiClient, oguild_id: str, date: str | None = None
) -> GuildBasic:
    data = await client.get("/maplestory/v1/guild/basic", {"oguild_id": oguild_id, "date": date})
    return GuildBasic.model_validate(data)
