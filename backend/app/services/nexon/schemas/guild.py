from pydantic import Field

from app.services.nexon.schemas.common import NexonModel, SkillInfo


class GuildId(NexonModel):
    oguild_id: str


class GuildBasic(NexonModel):
    date: str | None = None
    world_name: str
    guild_name: str
    guild_level: int
    guild_fame: int
    guild_point: int
    guild_master_name: str
    guild_member_count: int
    guild_user_count: int | None = None
    guild_member: list[str] = Field(default_factory=list)
    guild_skill: list[SkillInfo] = Field(default_factory=list)
    guild_noblesse_skill: list[SkillInfo] = Field(default_factory=list)
