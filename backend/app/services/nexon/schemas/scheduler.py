from pydantic import Field

from app.services.nexon.schemas.common import NexonModel


class SchedulerContent(NexonModel):
    content_name: str
    type: str | None = None
    registration_flag: str | None = None
    now_count: int | None = None
    max_count: int | None = None
    quest_state: str | None = None


class SchedulerBossContent(NexonModel):
    content_name: str
    difficulty: str | None = None
    cycle: str | None = None
    list_order_no: int | None = None
    registration_flag: str | None = None
    complete_flag: str | None = None
    weekly_boss_clear_count: int | None = None
    weekly_boss_clear_limit_count: int | None = None


class CharacterStateResponse(NexonModel):
    date: str | None = None
    character_name: str
    world_name: str
    character_level: int
    character_class: str
    daily_contents: list[SchedulerContent] = Field(default_factory=list)
    weekly_contents: list[SchedulerContent] = Field(default_factory=list)
    boss_contents: list[SchedulerBossContent] = Field(default_factory=list)
