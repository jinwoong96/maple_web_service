from pydantic import AliasChoices, Field

from app.services.nexon.schemas.common import (
    NexonModel,
    OptionEntry,
    OtherStatDetail,
    SkillInfo,
    StatBlockMixin,
    StatDetail,
    SymbolEquipment,
)

# --- Shared sub-models (reused across multiple endpoints) ---------------------------------


class ColorPrism(NexonModel):
    color_range: str
    hue: int
    saturation: int
    value: int
    black_inclusive_flag: str | None = None


class CustomOrigin(NexonModel):
    custom_origin_no: int
    x: str
    y: str


class CashItemEquipmentPiece(NexonModel):
    cash_item_equipment_part: str
    cash_item_equipment_slot: str
    cash_item_name: str
    cash_item_icon: str
    cash_item_description: str | None = None
    cash_item_option: list[OptionEntry] = Field(default_factory=list)
    date_expire: str | None = None
    date_option_expire: str | None = None
    cash_item_label: str | None = None
    # Not "cash_item_"-prefixed like their sibling fields — confirmed against a
    # live response.
    coloring_prism_flag: str | None = None
    cash_item_coloring_prism: ColorPrism | None = None
    effect_prism_flag: str | None = None
    cash_item_effect_prism: ColorPrism | None = None
    item_gender: str | None = None
    skills: list[str] = Field(default_factory=list)
    freestyle_flag: str | None = None
    emotion_name: str | None = None
    custom_origin: list[CustomOrigin] = Field(default_factory=list)


class HairStyle(NexonModel):
    # Optional: an android's hair override comes back with every field null
    # when unset, confirmed against a live response.
    hair_name: str | None = None
    base_color: str | None = None
    mix_color: str | None = None
    mix_rate: str | None = None
    freestyle_flag: str | None = None


class FaceStyle(NexonModel):
    face_name: str | None = None
    base_color: str | None = None
    mix_color: str | None = None
    mix_rate: str | None = None
    freestyle_flag: str | None = None


class SkinStyle(NexonModel):
    skin_name: str
    color_style: str | None = None
    hue: int | None = None
    saturation: int | None = None
    brightness: int | None = None


# item_equipment[] sub-option groups — Nexon uses several differently-shaped
# "option" blocks per equipped item; keep them distinct rather than forcing
# one shared shape.
class ItemOptionSummary(StatBlockMixin):
    max_hp: str | None = None
    max_mp: str | None = None
    attack_power: str | None = None
    magic_power: str | None = None
    armor: str | None = None
    speed: str | None = None
    jump: str | None = None
    boss_damage: str | None = None
    ignore_monster_armor: str | None = None
    all_stat: str | None = None
    damage: str | None = None
    equipment_level_decrease: int | None = None
    max_hp_rate: str | None = None
    max_mp_rate: str | None = None
    base_equipment_level: int | None = None


class ItemExceptionalOption(StatBlockMixin):
    max_hp: str | None = None
    max_mp: str | None = None
    attack_power: str | None = None
    magic_power: str | None = None
    exceptional_upgrade: int | None = None


class ItemAddOption(StatBlockMixin):
    max_hp: str | None = None
    max_mp: str | None = None
    attack_power: str | None = None
    magic_power: str | None = None
    armor: str | None = None
    speed: str | None = None
    jump: str | None = None
    boss_damage: str | None = None
    damage: str | None = None
    all_stat: str | None = None
    equipment_level_decrease: int | None = None
    growth_exp: int | None = None
    growth_level: int | None = None


class ItemEtcOption(StatBlockMixin):
    max_hp: str | None = None
    max_mp: str | None = None
    attack_power: str | None = None
    magic_power: str | None = None
    armor: str | None = None
    speed: str | None = None
    jump: str | None = None


class ItemEquipmentPiece(NexonModel):
    """One entry in ``item_equipment[]``."""

    item_equipment_part: str
    item_equipment_slot: str
    item_name: str
    item_icon: str | None = None
    item_description: str | None = None
    item_shape_name: str | None = None
    item_shape_icon: str | None = None
    item_gender: str | None = None
    item_total_option: ItemOptionSummary | None = None
    item_base_option: ItemOptionSummary | None = None
    potential_option_flag: str | None = None
    additional_potential_option_flag: str | None = None
    potential_option_grade: str | None = None
    additional_potential_option_grade: str | None = None
    potential_option_1: str | None = None
    potential_option_2: str | None = None
    potential_option_3: str | None = None
    additional_potential_option_1: str | None = None
    additional_potential_option_2: str | None = None
    additional_potential_option_3: str | None = None
    equipment_level_increase: int | None = None
    item_exceptional_option: ItemExceptionalOption | None = None
    item_add_option: ItemAddOption | None = None
    growth_exp: int | None = None
    growth_level: int | None = None
    scroll_upgrade: str | None = None
    cuttable_count: str | None = None
    golden_hammer_flag: str | None = None
    scroll_resilience_count: str | None = None
    # Nexon spells this two different ways across endpoints: no underscore on
    # the standalone item-equipment endpoint, but "upgrade_able" (with an
    # underscore) inside battle-practice/character-info's nested copy.
    scroll_upgradeable_count: str | None = Field(
        default=None,
        validation_alias=AliasChoices("scroll_upgradeable_count", "scroll_upgrade_able_count"),
    )
    soul_name: str | None = None
    soul_option: str | None = None
    item_etc_option: ItemEtcOption | None = None
    starforce: str | None = None
    starforce_scroll_flag: str | None = None
    item_starforce_option: ItemOptionSummary | None = None
    special_ring_level: int | None = None
    date_expire: str | None = None
    freestyle_flag: str | None = None


class PetEquipmentItem(NexonModel):
    # All fields come back null when the pet has no equipped item, confirmed
    # against a live response.
    item_name: str | None = None
    item_icon: str | None = None
    item_description: str | None = None
    item_option: list[OptionEntry] = Field(default_factory=list)
    scroll_upgrade: int | None = None
    scroll_upgradable: int | None = None
    item_shape: str | None = None
    item_shape_icon: str | None = None
    item_date_expire: str | None = None


class PetAutoSkill(NexonModel):
    skill_1: str | None = None
    skill_1_icon: str | None = None
    skill_2: str | None = None
    skill_2_icon: str | None = None


class WorldSharePetEquipmentPreset(PetEquipmentItem):
    preset_no: int
    slot_no: int


class PetSkillInfo(NexonModel):
    """Unlike ``SkillInfo``, these (e.g. petite Luna's pet skills) have no level."""

    skill_name: str
    skill_description: str | None = None
    skill_effect: str | None = None
    skill_icon: str | None = None


class AbilityInfo(NexonModel):
    ability_no: str
    ability_grade: str
    ability_value: str


class AbilityPreset(NexonModel):
    ability_preset_grade: str
    ability_info: list[AbilityInfo] = Field(default_factory=list)


class SetEffectInfo(NexonModel):
    set_count: int
    set_option: str


class SetEffect(NexonModel):
    set_name: str
    total_set_count: int
    set_effect_info: list[SetEffectInfo] = Field(default_factory=list)
    set_option_full: list[SetEffectInfo] = Field(default_factory=list)


class VCoreEquipment(NexonModel):
    slot_id: str | None = None
    slot_level: int | None = None
    v_core_name: str
    v_core_type: str
    v_core_level: int
    v_core_skill_1: str | None = None
    v_core_skill_2: str | None = None
    v_core_skill_3: str | None = None


class HexaCoreLinkedSkill(NexonModel):
    hexa_skill_id: str


class HexaCoreEquipment(NexonModel):
    hexa_core_name: str
    hexa_core_level: int
    hexa_core_event_level: int | None = None
    hexa_core_type: str
    linked_skill: list[HexaCoreLinkedSkill] = Field(default_factory=list)


class HexaStatCore(NexonModel):
    slot_id: str
    main_stat_name: str | None = None
    sub_stat_name_1: str | None = None
    sub_stat_name_2: str | None = None
    main_stat_level: int | None = None
    sub_stat_level_1: int | None = None
    sub_stat_level_2: int | None = None
    stat_grade: int | None = None


class HyperStatPreset(NexonModel):
    stat_type: str
    # null when the character hasn't invested any points in this stat yet,
    # confirmed against a live response.
    stat_point: int | None = None
    stat_level: int
    stat_increase: str | None = None


class AndroidPreset(NexonModel):
    android_name: str
    android_nickname: str | None = None
    android_icon: str | None = None
    android_description: str | None = None
    android_gender: str | None = None
    android_grade: str | None = None
    android_skin: SkinStyle | None = None
    android_hair: HairStyle | None = None
    android_face: FaceStyle | None = None
    android_ear_sensor_clip_flag: str | None = None
    android_non_humanoid_flag: str | None = None
    android_shop_usable_flag: str | None = None


# --- Endpoint response models --------------------------------------------------------------


class CharacterId(NexonModel):
    ocid: str


class CharacterBasic(NexonModel):
    date: str | None = None
    character_name: str
    world_name: str
    character_gender: str
    character_class: str
    character_class_level: str
    character_level: int
    character_exp: int
    character_exp_rate: str
    character_guild_name: str | None = None
    character_image: str
    character_date_create: str | None = None
    access_flag: str
    liberation_quest_clear: str | None = None


class CharacterPopularity(NexonModel):
    date: str | None = None
    popularity: int


class CharacterStat(NexonModel):
    date: str | None = None
    character_class: str
    final_stat: list[StatDetail] = Field(default_factory=list)
    remain_ap: int


class CharacterHyperStat(NexonModel):
    date: str | None = None
    character_class: str
    use_preset_no: str
    use_available_hyper_stat: int
    hyper_stat_preset_1: list[HyperStatPreset] = Field(default_factory=list)
    hyper_stat_preset_1_remain_point: int | None = None
    hyper_stat_preset_2: list[HyperStatPreset] = Field(default_factory=list)
    hyper_stat_preset_2_remain_point: int | None = None
    hyper_stat_preset_3: list[HyperStatPreset] = Field(default_factory=list)
    hyper_stat_preset_3_remain_point: int | None = None


class CharacterPropensity(NexonModel):
    date: str | None = None
    charisma_level: int
    sensibility_level: int
    insight_level: int
    willingness_level: int
    handicraft_level: int
    charm_level: int


class CharacterAbility(NexonModel):
    date: str | None = None
    ability_grade: str
    ability_info: list[AbilityInfo] = Field(default_factory=list)
    remain_fame: int | None = None
    preset_no: int | None = None
    ability_preset_1: AbilityPreset | None = None
    ability_preset_2: AbilityPreset | None = None
    ability_preset_3: AbilityPreset | None = None


class ItemTitle(NexonModel):
    title_name: str | None = None
    title_icon: str | None = None
    title_description: str | None = None
    date_expire: str | None = None
    date_option_expire: str | None = None
    title_shape_name: str | None = None
    title_shape_icon: str | None = None
    title_shape_description: str | None = None
    preset_no: int | None = None
    disable_flag: str | None = None


class MedalShape(NexonModel):
    medal_shape_name: str | None = None
    medal_shape_icon: str | None = None
    medal_shape_description: str | None = None
    medal_shape_changed_name: str | None = None
    medal_shape_changed_icon: str | None = None
    medal_shape_changed_description: str | None = None


class CharacterItemEquipment(NexonModel):
    date: str | None = None
    character_gender: str
    character_class: str
    preset_no: int | None = None
    item_equipment: list[ItemEquipmentPiece] = Field(default_factory=list)
    # item_equipment_preset_1/2/3 also appear in the live response, same shape.
    item_equipment_preset_1: list[ItemEquipmentPiece] = Field(default_factory=list)
    item_equipment_preset_2: list[ItemEquipmentPiece] = Field(default_factory=list)
    item_equipment_preset_3: list[ItemEquipmentPiece] = Field(default_factory=list)
    title: ItemTitle | None = None
    title_preset1: ItemTitle | None = None
    title_preset2: ItemTitle | None = None
    title_preset3: ItemTitle | None = None
    medal_shape: MedalShape | None = None
    # Xenon-only / Mechanic-only equipment slots; empty for other classes.
    dragon_equipment: list[ItemEquipmentPiece] = Field(default_factory=list)
    mechanic_equipment: list[ItemEquipmentPiece] = Field(default_factory=list)


class CharacterCashItemEquipment(NexonModel):
    date: str | None = None
    character_gender: str
    character_class: str
    character_look_mode: str | None = None
    preset_no: int | None = None
    cash_item_equipment_base: list[CashItemEquipmentPiece] = Field(default_factory=list)
    cash_item_equipment_preset_1: list[CashItemEquipmentPiece] = Field(default_factory=list)
    cash_item_equipment_preset_2: list[CashItemEquipmentPiece] = Field(default_factory=list)
    cash_item_equipment_preset_3: list[CashItemEquipmentPiece] = Field(default_factory=list)
    additional_cash_item_equipment_base: list[CashItemEquipmentPiece] = Field(default_factory=list)
    additional_cash_item_equipment_preset_1: list[CashItemEquipmentPiece] = Field(
        default_factory=list
    )
    additional_cash_item_equipment_preset_2: list[CashItemEquipmentPiece] = Field(
        default_factory=list
    )
    additional_cash_item_equipment_preset_3: list[CashItemEquipmentPiece] = Field(
        default_factory=list
    )


class CharacterSymbolEquipment(NexonModel):
    date: str | None = None
    character_class: str
    symbol: list[SymbolEquipment] = Field(default_factory=list)


class CharacterSetEffect(NexonModel):
    date: str | None = None
    set_effect: list[SetEffect] = Field(default_factory=list)


class CharacterBeautyEquipment(NexonModel):
    date: str | None = None
    character_gender: str
    character_class: str
    character_hair: HairStyle | None = None
    character_face: FaceStyle | None = None
    character_skin: SkinStyle | None = None
    additional_character_hair: HairStyle | None = None
    additional_character_face: FaceStyle | None = None
    additional_character_skin: SkinStyle | None = None


class CharacterAndroidEquipment(NexonModel):
    date: str | None = None
    android_name: str
    android_nickname: str | None = None
    android_icon: str | None = None
    android_description: str | None = None
    android_hair: HairStyle | None = None
    android_face: FaceStyle | None = None
    android_skin: SkinStyle | None = None
    android_cash_item_equipment: list[CashItemEquipmentPiece] = Field(default_factory=list)
    android_item_gender: str | None = None
    freestyle_flag: str | None = None
    android_ear_sensor_clip_flag: str | None = None
    android_gender: str | None = None
    android_grade: str | None = None
    android_non_humanoid_flag: str | None = None
    android_shop_usable_flag: str | None = None
    preset_no: int | None = None
    android_preset_1: AndroidPreset | None = None
    android_preset_2: AndroidPreset | None = None
    android_preset_3: AndroidPreset | None = None


class CharacterPetEquipment(NexonModel):
    date: str | None = None
    pet_activate_flag: str | None = None
    pet_1_name: str | None = None
    pet_1_nickname: str | None = None
    pet_1_icon: str | None = None
    pet_1_description: str | None = None
    pet_1_equipment: PetEquipmentItem | None = None
    pet_1_auto_skill: PetAutoSkill | None = None
    pet_1_pet_type: str | None = None
    pet_1_skill: list[str] = Field(default_factory=list)
    pet_1_date_expire: str | None = None
    pet_1_appearance: str | None = None
    pet_1_appearance_icon: str | None = None
    pet_2_name: str | None = None
    pet_2_nickname: str | None = None
    pet_2_icon: str | None = None
    pet_2_description: str | None = None
    pet_2_equipment: PetEquipmentItem | None = None
    pet_2_auto_skill: PetAutoSkill | None = None
    pet_2_pet_type: str | None = None
    pet_2_skill: list[str] = Field(default_factory=list)
    pet_2_date_expire: str | None = None
    pet_2_appearance: str | None = None
    pet_2_appearance_icon: str | None = None
    pet_3_name: str | None = None
    pet_3_nickname: str | None = None
    pet_3_icon: str | None = None
    pet_3_description: str | None = None
    pet_3_equipment: PetEquipmentItem | None = None
    pet_3_auto_skill: PetAutoSkill | None = None
    pet_3_pet_type: str | None = None
    pet_3_skill: list[str] = Field(default_factory=list)
    pet_3_date_expire: str | None = None
    pet_3_appearance: str | None = None
    pet_3_appearance_icon: str | None = None
    world_share_pet_1_name: str | None = None
    world_share_pet_1_nickname: str | None = None
    world_share_pet_1_icon: str | None = None
    world_share_pet_1_description: str | None = None
    world_share_pet_1_pet_type: str | None = None
    world_share_pet_1_equipment_preset_no: int | None = None
    world_share_pet_1_equipment: PetEquipmentItem | None = None
    world_share_pet_1_auto_skill: PetAutoSkill | None = None
    world_share_pet_1_skill: list[str] = Field(default_factory=list)
    world_share_pet_1_date_expire: str | None = None
    world_share_pet_1_appearance: str | None = None
    world_share_pet_1_appearance_icon: str | None = None
    world_share_pet_2_name: str | None = None
    world_share_pet_2_nickname: str | None = None
    world_share_pet_2_icon: str | None = None
    world_share_pet_2_description: str | None = None
    world_share_pet_2_pet_type: str | None = None
    world_share_pet_2_equipment_preset_no: int | None = None
    world_share_pet_2_equipment: PetEquipmentItem | None = None
    world_share_pet_2_auto_skill: PetAutoSkill | None = None
    world_share_pet_2_skill: list[str] = Field(default_factory=list)
    world_share_pet_2_date_expire: str | None = None
    world_share_pet_2_appearance: str | None = None
    world_share_pet_2_appearance_icon: str | None = None
    world_share_pet_3_name: str | None = None
    world_share_pet_3_nickname: str | None = None
    world_share_pet_3_icon: str | None = None
    world_share_pet_3_description: str | None = None
    world_share_pet_3_pet_type: str | None = None
    world_share_pet_3_equipment_preset_no: int | None = None
    world_share_pet_3_equipment: PetEquipmentItem | None = None
    world_share_pet_3_auto_skill: PetAutoSkill | None = None
    world_share_pet_3_skill: list[str] = Field(default_factory=list)
    world_share_pet_3_date_expire: str | None = None
    world_share_pet_3_appearance: str | None = None
    world_share_pet_3_appearance_icon: str | None = None
    world_share_pet_equipment_preset: list[WorldSharePetEquipmentPreset] = Field(
        default_factory=list
    )
    petite_luna_pet_skill: list[PetSkillInfo] = Field(default_factory=list)


class CharacterSkill(NexonModel):
    date: str | None = None
    character_class: str
    # Nexon returns null (with an empty character_skill[]) for a grade this
    # character has no skills in — e.g. the 1.5/2.5 hidden-skill tiers on a
    # class that doesn't have one. Confirmed live via 다섯별(메카닉), 2026-09-20.
    character_skill_grade: str | None = None
    character_skill: list[SkillInfo] = Field(default_factory=list)


class CharacterLinkSkill(NexonModel):
    date: str | None = None
    character_class: str
    character_link_skill: list[SkillInfo] = Field(default_factory=list)
    character_link_skill_preset_1: list[SkillInfo] = Field(default_factory=list)
    character_link_skill_preset_2: list[SkillInfo] = Field(default_factory=list)
    character_link_skill_preset_3: list[SkillInfo] = Field(default_factory=list)
    character_owned_link_skill: SkillInfo | None = None
    character_owned_link_skill_preset_1: SkillInfo | None = None
    character_owned_link_skill_preset_2: SkillInfo | None = None
    character_owned_link_skill_preset_3: SkillInfo | None = None


class CharacterVMatrix(NexonModel):
    date: str | None = None
    character_class: str
    character_v_core_equipment: list[VCoreEquipment] = Field(default_factory=list)
    character_v_matrix_remain_slot_upgrade_point: int | None = None
    character_v_core_equipment_preset_1: list[VCoreEquipment] = Field(default_factory=list)
    character_v_core_equipment_preset_2: list[VCoreEquipment] = Field(default_factory=list)
    character_v_core_equipment_preset_3: list[VCoreEquipment] = Field(default_factory=list)
    character_v_core_equipment_preset_4: list[VCoreEquipment] = Field(default_factory=list)
    character_v_core_equipment_preset_5: list[VCoreEquipment] = Field(default_factory=list)


class CharacterHexaMatrix(NexonModel):
    date: str | None = None
    character_hexa_core_equipment: list[HexaCoreEquipment] = Field(default_factory=list)


class CharacterHexaMatrixStat(NexonModel):
    date: str | None = None
    character_class: str
    character_hexa_stat_core: list[HexaStatCore] = Field(default_factory=list)
    character_hexa_stat_core_2: list[HexaStatCore] = Field(default_factory=list)
    character_hexa_stat_core_3: list[HexaStatCore] = Field(default_factory=list)
    preset_hexa_stat_core: list[HexaStatCore] = Field(default_factory=list)
    preset_hexa_stat_core_2: list[HexaStatCore] = Field(default_factory=list)
    preset_hexa_stat_core_3: list[HexaStatCore] = Field(default_factory=list)


class CharacterDojang(NexonModel):
    date: str | None = None
    character_class: str
    world_name: str
    dojang_best_floor: int
    date_dojang_record: str | None = None
    dojang_best_time: int


class CharacterOtherStat(NexonModel):
    date: str | None = None
    other_stat: list[OtherStatDetail] = Field(default_factory=list)


class RingExchangeSkillEquipment(NexonModel):
    date: str | None = None
    character_class: str
    special_ring_exchange_name: str | None = None
    special_ring_exchange_level: int | None = None
    special_ring_exchange_icon: str | None = None
    special_ring_exchange_description: str | None = None


class RingReserveSkillEquipment(NexonModel):
    date: str | None = None
    character_class: str
    special_ring_reserve_name: str | None = None
    special_ring_reserve_level: int | None = None
    special_ring_reserve_icon: str | None = None
    special_ring_reserve_description: str | None = None
