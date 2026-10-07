from pydantic import Field

from app.services.nexon.schemas.common import NexonModel, PotentialOptionEntry


class AccountOuid(NexonModel):
    ouid: str


class StarforceEvent(NexonModel):
    success_rate: str | None = None
    destroy_decrease_rate: str | None = None
    cost_discount_rate: str | None = None
    plus_value: str | None = None
    starforce_event_range: str | None = None
    recovery_cost_discount_rate: str | None = None


class StarforceHistoryEntry(NexonModel):
    id: str
    item_upgrade_result: str
    before_starforce_count: int | None = None
    after_starforce_count: int | None = None
    starcatch_result: str | None = None
    superior_item_flag: str | None = None
    destroy_defence: str | None = None
    chance_time: str | None = None
    event_field_flag: str | None = None
    upgrade_item: str | None = None
    protect_shield: str | None = None
    bonus_stat_upgrade: str | None = None
    character_name: str | None = None
    world_name: str | None = None
    target_item: str | None = None
    date_create: str | None = None
    starforce_event_list: list[StarforceEvent] = Field(default_factory=list)


class StarforceHistory(NexonModel):
    count: int
    next_cursor: str | None = None
    starforce_history: list[StarforceHistoryEntry] = Field(default_factory=list)


class PotentialHistoryEntry(NexonModel):
    id: str
    character_name: str | None = None
    date_create: str | None = None
    potential_type: str
    item_upgrade_result: str | None = None
    miracle_time_flag: str | None = None
    item_equipment_part: str | None = None
    item_level: int | None = None
    target_item: str | None = None
    potential_option_grade: str | None = None
    additional_potential_option_grade: str | None = None
    upgrade_guarantee: bool | None = None
    upgrade_guarantee_count: int | None = None
    before_potential_option: list[PotentialOptionEntry] = Field(default_factory=list)
    before_additional_potential_option: list[PotentialOptionEntry] = Field(default_factory=list)
    after_potential_option: list[PotentialOptionEntry] = Field(default_factory=list)
    after_additional_potential_option: list[PotentialOptionEntry] = Field(default_factory=list)


class PotentialHistory(NexonModel):
    count: int
    next_cursor: str | None = None
    potential_history: list[PotentialHistoryEntry] = Field(default_factory=list)


class CubeHistoryEntry(NexonModel):
    id: str
    character_name: str | None = None
    date_create: str | None = None
    cube_type: str
    item_upgrade_result: str | None = None
    miracle_time_flag: str | None = None
    item_equipment_part: str | None = None
    item_level: int | None = None
    target_item: str | None = None
    potential_option_grade: str | None = None
    additional_potential_option_grade: str | None = None
    upgrade_guarantee: bool | None = None
    upgrade_guarantee_count: int | None = None
    before_potential_option: list[PotentialOptionEntry] = Field(default_factory=list)
    before_additional_potential_option: list[PotentialOptionEntry] = Field(default_factory=list)
    after_potential_option: list[PotentialOptionEntry] = Field(default_factory=list)
    after_additional_potential_option: list[PotentialOptionEntry] = Field(default_factory=list)


class CubeHistory(NexonModel):
    count: int
    next_cursor: str | None = None
    cube_history: list[CubeHistoryEntry] = Field(default_factory=list)
