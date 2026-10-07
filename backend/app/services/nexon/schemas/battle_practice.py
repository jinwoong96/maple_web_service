from pydantic import Field

from app.services.nexon.schemas.character import (
    AbilityInfo,
    CashItemEquipmentPiece,
    HexaCoreEquipment,
    HexaStatCore,
    ItemEquipmentPiece,
    ItemTitle,
    PetAutoSkill,
    PetEquipmentItem,
    SetEffect,
    VCoreEquipment,
)
from app.services.nexon.schemas.common import (
    NexonModel,
    OtherStatDetail,
    SkillInfo,
    StatDetail,
    SymbolEquipment,
)
from app.services.nexon.schemas.union import UnionArtifactEffect, UnionChampionBadge


class ReplayEntry(NexonModel):
    period_no: int
    register_date: str
    replay_id: str


class ReplayId(NexonModel):
    replay_list: list[ReplayEntry] = Field(default_factory=list)


class SkillStatistic(NexonModel):
    skill_name: str
    damage: int | None = None
    damage_percent: str | None = None
    dps: int | None = None
    use_count: int | None = None
    damage_per_use: int | None = None
    attack_count: int | None = None
    max_damage: int | None = None
    min_damage: int | None = None


class BattlePracticeResult(NexonModel):
    register_date: str | None = None
    total_play_time: int | None = None
    total_damage: int | None = None
    total_dps: int | None = None
    end_type: str | None = None
    like_count: int | None = None
    skill_statistic: list[SkillStatistic] = Field(default_factory=list)


class SkillTimelineEntry(NexonModel):
    elapse_time: int | None = None
    skill_name: str
    hexa_skill_specificity_flag: str | None = None
    sequence_name: str | None = None
    sequence_key: str | None = None


class SkillTimeline(NexonModel):
    page_no: int | None = None
    total_page_no: int | None = None
    skill_timeline: list[SkillTimelineEntry] = Field(default_factory=list)


# --- character-info: a full character snapshot at recording time, bundling ------------------
# reduced versions of nearly every other category's data under "*_object" keys.
# Confirmed against a live response (박세웅, 2026-08-30).


class BattlePracticeBasicObject(NexonModel):
    character_name: str
    character_level: int
    character_class: str
    character_class_level: str | None = None
    character_image: str | None = None


class BattlePracticeBasicStatObject(NexonModel):
    final_stat: list[StatDetail] = Field(default_factory=list)


class BattlePracticeSymbolStatObject(NexonModel):
    symbol: list[SymbolEquipment] = Field(default_factory=list)


class BattlePracticeOtherStatObject(NexonModel):
    other_stat: list[OtherStatDetail] = Field(default_factory=list)


class BattlePracticeStatObject(NexonModel):
    basic_stat_object: BattlePracticeBasicStatObject | None = None
    symbol_stat_object: BattlePracticeSymbolStatObject | None = None
    other_stat_object: BattlePracticeOtherStatObject | None = None


class BattlePracticeHyperStatEntry(NexonModel):
    stat_type: str
    stat_point: int | None = None
    stat_level: int | None = None
    stat_increase: str | None = None


class BattlePracticeHyperStatObject(NexonModel):
    hyper_stat: list[BattlePracticeHyperStatEntry] = Field(default_factory=list)


class BattlePracticePropensityObject(NexonModel):
    charisma_level: int | None = None
    sensibility_level: int | None = None
    insight_level: int | None = None
    willingness_level: int | None = None
    handicraft_level: int | None = None
    charm_level: int | None = None


class BattlePracticeAbilityObject(NexonModel):
    ability_info: list[AbilityInfo] = Field(default_factory=list)


class BattlePracticeItemEquipmentObject(NexonModel):
    item_equipment: list[ItemEquipmentPiece] = Field(default_factory=list)
    dragon_equipment: list[ItemEquipmentPiece] = Field(default_factory=list)
    mechanic_equipment: list[ItemEquipmentPiece] = Field(default_factory=list)
    title: ItemTitle | None = None


class BattlePracticeSetEffectObject(NexonModel):
    set_effect: list[SetEffect] = Field(default_factory=list)


class BattlePracticeItemObject(NexonModel):
    item_equipment_object: BattlePracticeItemEquipmentObject | None = None
    set_effect_object: BattlePracticeSetEffectObject | None = None


class BattlePracticeCashItemObject(NexonModel):
    cash_item_equipment_base: list[CashItemEquipmentPiece] = Field(default_factory=list)
    additional_cash_item_equipment_base: list[CashItemEquipmentPiece] = Field(default_factory=list)


class BattlePracticePetObject(NexonModel):
    """A reduced version of the standalone pet-equipment endpoint's shape
    (no ``pet_activate_flag`` or appearance fields)."""

    pet_1_name: str | None = None
    pet_1_nickname: str | None = None
    pet_1_icon: str | None = None
    pet_1_description: str | None = None
    pet_1_equipment: PetEquipmentItem | None = None
    pet_1_auto_skill: PetAutoSkill | None = None
    pet_1_pet_type: str | None = None
    pet_1_skill: list[str] = Field(default_factory=list)
    pet_1_date_expire: str | None = None
    pet_2_name: str | None = None
    pet_2_nickname: str | None = None
    pet_2_icon: str | None = None
    pet_2_description: str | None = None
    pet_2_equipment: PetEquipmentItem | None = None
    pet_2_auto_skill: PetAutoSkill | None = None
    pet_2_pet_type: str | None = None
    pet_2_skill: list[str] = Field(default_factory=list)
    pet_2_date_expire: str | None = None
    pet_3_name: str | None = None
    pet_3_nickname: str | None = None
    pet_3_icon: str | None = None
    pet_3_description: str | None = None
    pet_3_equipment: PetEquipmentItem | None = None
    pet_3_auto_skill: PetAutoSkill | None = None
    pet_3_pet_type: str | None = None
    pet_3_skill: list[str] = Field(default_factory=list)
    pet_3_date_expire: str | None = None


class BattlePracticeSkillObject(NexonModel):
    character_skill: list[SkillInfo] = Field(default_factory=list)


class BattlePracticeLinkSkillObject(NexonModel):
    character_link_skill: list[SkillInfo] = Field(default_factory=list)
    character_owned_link_skill: SkillInfo | None = None


class BattlePracticeVMatrixObject(NexonModel):
    character_v_core_equipment: list[VCoreEquipment] = Field(default_factory=list)


class BattlePracticeHexaCoreObject(NexonModel):
    character_hexa_core_equipment: list[HexaCoreEquipment] = Field(default_factory=list)


class BattlePracticeHexaMatrixStatObject(NexonModel):
    character_hexa_stat_core: list[HexaStatCore] = Field(default_factory=list)
    character_hexa_stat_core_2: list[HexaStatCore] = Field(default_factory=list)
    character_hexa_stat_core_3: list[HexaStatCore] = Field(default_factory=list)


class BattlePracticeHexaMatrixObject(NexonModel):
    hexa_core_object: BattlePracticeHexaCoreObject | None = None
    hexa_matrix_stat_object: BattlePracticeHexaMatrixStatObject | None = None


class BattlePracticeRingReserveSkillObject(NexonModel):
    special_ring_reserve_name: str | None = None
    special_ring_reserve_level: int | None = None
    special_ring_reserve_icon: str | None = None
    special_ring_reserve_description: str | None = None


class BattlePracticeUnionRaiderObject(NexonModel):
    union_raider_stat: list[str] = Field(default_factory=list)
    union_occupied_stat: list[str] = Field(default_factory=list)


class BattlePracticeUnionArtifactObject(NexonModel):
    union_artifact_effect: list[UnionArtifactEffect] = Field(default_factory=list)


class BattlePracticeUnionChampionObject(NexonModel):
    champion_badge_total_info: list[UnionChampionBadge] = Field(default_factory=list)


class BattlePracticeGuildObject(NexonModel):
    guild_skill: list[SkillInfo] = Field(default_factory=list)
    guild_noblesse_skill: list[SkillInfo] = Field(default_factory=list)


class BattlePracticeCharacterInfo(NexonModel):
    basic_object: BattlePracticeBasicObject | None = None
    stat_object: BattlePracticeStatObject | None = None
    hyper_stat_object: BattlePracticeHyperStatObject | None = None
    propensity_object: BattlePracticePropensityObject | None = None
    ability_object: BattlePracticeAbilityObject | None = None
    item_object: BattlePracticeItemObject | None = None
    cash_item_object: BattlePracticeCashItemObject | None = None
    pet_object: BattlePracticePetObject | None = None
    skill_object: BattlePracticeSkillObject | None = None
    link_skill_object: BattlePracticeLinkSkillObject | None = None
    v_matrix_object: BattlePracticeVMatrixObject | None = None
    hexa_matrix_object: BattlePracticeHexaMatrixObject | None = None
    ring_reserve_skill_object: BattlePracticeRingReserveSkillObject | None = None
    union_raider_object: BattlePracticeUnionRaiderObject | None = None
    union_artifact_object: BattlePracticeUnionArtifactObject | None = None
    union_champion_object: BattlePracticeUnionChampionObject | None = None
    guild_object: BattlePracticeGuildObject | None = None
