"""Regression tests for Nexon quirks discovered via live API verification:
null instead of an empty list for "no data" fields, and fields documented as
always-present that can actually come back null."""

from app.services.nexon.schemas.battle_practice import BattlePracticeCharacterInfo
from app.services.nexon.schemas.character import (
    CharacterOtherStat,
    HyperStatPreset,
    ItemEquipmentPiece,
)
from app.services.nexon.schemas.union import CharacterUnionChampion


def test_null_list_field_coerced_to_empty_list() -> None:
    other_stat = CharacterOtherStat.model_validate({"date": None, "other_stat": None})
    assert other_stat.other_stat == []


def test_hyper_stat_preset_allows_null_stat_point() -> None:
    preset = HyperStatPreset.model_validate(
        {"stat_type": "STR", "stat_point": None, "stat_level": 0, "stat_increase": None}
    )
    assert preset.stat_point is None


def test_union_champion_badge_total_info_is_top_level() -> None:
    champion = CharacterUnionChampion.model_validate(
        {
            "date": None,
            "union_champion": [
                {
                    "champion_name": "test",
                    "champion_slot": 1,
                    "champion_grade": "S",
                    "champion_class": "test",
                    "champion_badge_info": [],
                }
            ],
            "champion_badge_total_info": [{"stat": "공격력 10 증가"}],
        }
    )
    assert champion.champion_badge_total_info[0].stat == "공격력 10 증가"


def test_item_equipment_piece_accepts_either_scroll_upgradeable_spelling() -> None:
    """Nexon spells this field differently on two endpoints: no underscore on
    character/item-equipment, "upgrade_able" inside battle-practice's nested
    copy of the same object."""
    base = {"item_equipment_part": "무기", "item_equipment_slot": "무기", "item_name": "test"}

    no_underscore = ItemEquipmentPiece.model_validate({**base, "scroll_upgradeable_count": "1"})
    assert no_underscore.scroll_upgradeable_count == "1"

    with_underscore = ItemEquipmentPiece.model_validate({**base, "scroll_upgrade_able_count": "2"})
    assert with_underscore.scroll_upgradeable_count == "2"


def test_battle_practice_character_info_hyper_stat_is_top_level() -> None:
    """hyper_stat_object/propensity_object/etc. are siblings of stat_object at
    the top level, not nested inside it (the live response differs from the
    docs' example, which showed them nested)."""
    info = BattlePracticeCharacterInfo.model_validate(
        {
            "stat_object": {"basic_stat_object": {"final_stat": []}},
            "hyper_stat_object": {
                "hyper_stat": [{"stat_type": "STR", "stat_level": 1, "stat_increase": "x"}]
            },
        }
    )
    assert info.hyper_stat_object is not None
    assert info.hyper_stat_object.hyper_stat[0].stat_type == "STR"
