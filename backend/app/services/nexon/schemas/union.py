from pydantic import Field

from app.services.nexon.schemas.common import NexonModel


class UnionInfo(NexonModel):
    date: str | None = None
    union_level: int
    union_grade: str
    union_artifact_level: int
    union_artifact_exp: int
    union_artifact_point: int


class UnionBlockPosition(NexonModel):
    x: str
    y: str


class UnionBlock(NexonModel):
    block_type: str
    block_class: str
    block_level: str
    block_control_point: UnionBlockPosition | None = None
    block_position: list[UnionBlockPosition] = Field(default_factory=list)


class UnionInnerStat(NexonModel):
    stat_field_id: str
    stat_field_effect: str


class UnionStateStatPreset(NexonModel):
    preset_no: int
    union_state_stat: list[str] = Field(default_factory=list)


class UnionRaiderPreset(NexonModel):
    union_raider_stat: list[str] = Field(default_factory=list)
    union_occupied_stat: list[str] = Field(default_factory=list)
    union_inner_stat: list[UnionInnerStat] = Field(default_factory=list)
    union_block: list[UnionBlock] = Field(default_factory=list)


class UnionRaider(NexonModel):
    date: str | None = None
    union_raider_stat: list[str] = Field(default_factory=list)
    union_state_stat: list[str] = Field(default_factory=list)
    union_state_stat_preset: list[UnionStateStatPreset] = Field(default_factory=list)
    union_max_point: int | None = None
    union_occupied_stat: list[str] = Field(default_factory=list)
    union_inner_stat: list[UnionInnerStat] = Field(default_factory=list)
    union_block: list[UnionBlock] = Field(default_factory=list)
    use_preset_no: int | None = None
    union_raider_preset_1: UnionRaiderPreset | None = None
    union_raider_preset_2: UnionRaiderPreset | None = None
    union_raider_preset_3: UnionRaiderPreset | None = None
    union_raider_preset_4: UnionRaiderPreset | None = None
    union_raider_preset_5: UnionRaiderPreset | None = None


class UnionArtifactEffect(NexonModel):
    name: str
    level: int


class UnionArtifactCrystal(NexonModel):
    name: str
    validity_flag: str
    date_expire: str | None = None
    level: int
    crystal_option_name_1: str | None = None
    crystal_option_name_2: str | None = None
    crystal_option_name_3: str | None = None


class UnionArtifact(NexonModel):
    date: str | None = None
    union_artifact_effect: list[UnionArtifactEffect] = Field(default_factory=list)
    union_artifact_crystal: list[UnionArtifactCrystal] = Field(default_factory=list)
    union_artifact_remain_ap: int | None = None


class UnionChampionBadge(NexonModel):
    stat: str


class UnionChampion(NexonModel):
    champion_name: str
    champion_slot: int | None = None
    champion_grade: str
    champion_class: str
    champion_badge_info: list[UnionChampionBadge] = Field(default_factory=list)


class CharacterUnionChampion(NexonModel):
    date: str | None = None
    union_champion: list[UnionChampion] = Field(default_factory=list)
    # Totals across all equipped champion badges — a sibling of union_champion,
    # not per-champion (confirmed against a live response).
    champion_badge_total_info: list[UnionChampionBadge] = Field(default_factory=list)
