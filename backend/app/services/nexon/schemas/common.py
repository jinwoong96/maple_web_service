"""Models shared across multiple Nexon Open API categories."""

from typing import Any, get_origin

from pydantic import BaseModel, ConfigDict, Field, model_validator


class NexonModel(BaseModel):
    """Base for all Nexon response models.

    ``extra="allow"`` because Nexon adds fields to these responses over time
    (see the API's own changelog) and we'd rather keep working than 500 on an
    unrecognized field. ``populate_by_name`` so aliased fields (``str``/``int``/
    ``class``, which shadow Python builtins/keywords) can still be set by their
    Python name too.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def _coerce_null_lists_to_empty(cls, data: Any) -> Any:
        """Nexon sometimes sends ``null`` instead of ``[]`` for a "no data" list
        field (confirmed on ``character/other-stat``'s ``other_stat``) — treat
        that the same as an empty list rather than failing validation."""
        if not isinstance(data, dict):
            return data
        for name, field in cls.model_fields.items():
            key = field.alias or name
            if key in data and data[key] is None and get_origin(field.annotation) is list:
                data[key] = []
        return data


class StatBlockMixin(NexonModel):
    """``str``/``dex``/``int``/``luk`` appear verbatim in several Nexon option
    blocks; ``str``/``int`` are aliased since they shadow Python builtins."""

    str_: str | None = Field(default=None, alias="str")
    dex: str | None = None
    int_: str | None = Field(default=None, alias="int")
    luk: str | None = None


class OptionEntry(NexonModel):
    option_type: str
    option_value: str


class SkillInfo(NexonModel):
    skill_name: str
    skill_description: str | None = None
    skill_level: int
    skill_effect: str | None = None
    skill_effect_next: str | None = None
    skill_icon: str | None = None


class StatDetail(NexonModel):
    stat_name: str
    stat_value: str


class OtherStatDetail(NexonModel):
    other_stat_type: str
    stat_info: list[StatDetail] = Field(default_factory=list)


class SymbolEquipment(NexonModel):
    symbol_name: str
    symbol_icon: str | None = None
    symbol_description: str | None = None
    symbol_other_effect_description: str | None = None
    symbol_force: str | None = None
    symbol_level: int
    symbol_str: str | None = None
    symbol_dex: str | None = None
    symbol_int: str | None = None
    symbol_luk: str | None = None
    symbol_hp: str | None = None
    symbol_drop_rate: str | None = None
    symbol_meso_rate: str | None = None
    symbol_exp_rate: str | None = None
    symbol_growth_count: int | None = None
    symbol_require_growth_count: int | None = None


class PotentialOptionEntry(NexonModel):
    value: str
    grade: str
