"""Endpoint functions for the Nexon Open API "캐릭터 정보 조회" (Character) category.

Every endpoint here takes an ``ocid`` (obtained via ``get_ocid``) and an
optional ``date`` (KST, ``YYYY-MM-DD`` — defaults to the latest available day
when omitted). ``character/skill`` additionally requires ``character_skill_grade``.
"""

from datetime import date as _date
from datetime import datetime, timedelta, timezone

_KST = timezone(timedelta(hours=9))

from pydantic import BaseModel

from app.services.nexon.client import NexonApiClient
from app.services.nexon.schemas.character import (
    CharacterAbility,
    CharacterAndroidEquipment,
    CharacterBasic,
    CharacterBeautyEquipment,
    CharacterCashItemEquipment,
    CharacterDojang,
    CharacterHexaMatrix,
    CharacterHexaMatrixStat,
    CharacterHyperStat,
    CharacterItemEquipment,
    CharacterLinkSkill,
    CharacterOtherStat,
    CharacterPetEquipment,
    CharacterPopularity,
    CharacterPropensity,
    CharacterSetEffect,
    CharacterSkill,
    CharacterStat,
    CharacterSymbolEquipment,
    CharacterVMatrix,
    RingExchangeSkillEquipment,
    RingReserveSkillEquipment,
)


async def _get[ModelT: BaseModel](
    client: NexonApiClient,
    path: str,
    model: type[ModelT],
    ocid: str,
    date: str | None = None,
    **extra_params: str | None,
) -> ModelT:
    data = await client.get(path, {"ocid": ocid, "date": date, **extra_params})
    return model.model_validate(data)


async def get_ocid(client: NexonApiClient, character_name: str) -> str:
    data = await client.get("/maplestory/v1/id", {"character_name": character_name})
    ocid: str = data["ocid"]
    return ocid


async def get_character_basic(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterBasic:
    return await _get(client, "/maplestory/v1/character/basic", CharacterBasic, ocid, date)


async def get_character_popularity(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterPopularity:
    return await _get(
        client, "/maplestory/v1/character/popularity", CharacterPopularity, ocid, date
    )


async def get_character_stat(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterStat:
    return await _get(client, "/maplestory/v1/character/stat", CharacterStat, ocid, date)


async def get_character_hyper_stat(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterHyperStat:
    return await _get(client, "/maplestory/v1/character/hyper-stat", CharacterHyperStat, ocid, date)


async def get_character_propensity(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterPropensity:
    return await _get(
        client, "/maplestory/v1/character/propensity", CharacterPropensity, ocid, date
    )


async def get_character_ability(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterAbility:
    return await _get(client, "/maplestory/v1/character/ability", CharacterAbility, ocid, date)


async def get_character_item_equipment(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterItemEquipment:
    return await _get(
        client, "/maplestory/v1/character/item-equipment", CharacterItemEquipment, ocid, date
    )


async def get_character_cashitem_equipment(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterCashItemEquipment:
    return await _get(
        client,
        "/maplestory/v1/character/cashitem-equipment",
        CharacterCashItemEquipment,
        ocid,
        date,
    )


async def get_character_symbol_equipment(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterSymbolEquipment:
    return await _get(
        client, "/maplestory/v1/character/symbol-equipment", CharacterSymbolEquipment, ocid, date
    )


async def get_character_set_effect(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterSetEffect:
    return await _get(client, "/maplestory/v1/character/set-effect", CharacterSetEffect, ocid, date)


async def get_character_beauty_equipment(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterBeautyEquipment:
    return await _get(
        client, "/maplestory/v1/character/beauty-equipment", CharacterBeautyEquipment, ocid, date
    )


async def get_character_android_equipment(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterAndroidEquipment:
    return await _get(
        client,
        "/maplestory/v1/character/android-equipment",
        CharacterAndroidEquipment,
        ocid,
        date,
    )


async def get_character_pet_equipment(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterPetEquipment:
    return await _get(
        client, "/maplestory/v1/character/pet-equipment", CharacterPetEquipment, ocid, date
    )


async def get_character_skill(
    client: NexonApiClient,
    ocid: str,
    character_skill_grade: str,
    date: str | None = None,
) -> CharacterSkill:
    return await _get(
        client,
        "/maplestory/v1/character/skill",
        CharacterSkill,
        ocid,
        date,
        character_skill_grade=character_skill_grade,
    )


async def get_character_link_skill(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterLinkSkill:
    return await _get(client, "/maplestory/v1/character/link-skill", CharacterLinkSkill, ocid, date)


async def get_character_vmatrix(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterVMatrix:
    return await _get(client, "/maplestory/v1/character/vmatrix", CharacterVMatrix, ocid, date)


async def get_character_hexamatrix(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterHexaMatrix:
    return await _get(
        client, "/maplestory/v1/character/hexamatrix", CharacterHexaMatrix, ocid, date
    )


async def get_character_hexamatrix_stat(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterHexaMatrixStat:
    return await _get(
        client, "/maplestory/v1/character/hexamatrix-stat", CharacterHexaMatrixStat, ocid, date
    )


async def get_character_dojang(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterDojang:
    return await _get(client, "/maplestory/v1/character/dojang", CharacterDojang, ocid, date)


async def get_character_other_stat(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> CharacterOtherStat:
    return await _get(client, "/maplestory/v1/character/other-stat", CharacterOtherStat, ocid, date)


async def _get_character_ring_exchange_skill_equipment(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> RingExchangeSkillEquipment:
    return await _get(
        client,
        "/maplestory/v1/character/ring-exchange-skill-equipment",
        RingExchangeSkillEquipment,
        ocid,
        date,
    )


async def _get_character_ring_reserve_skill_equipment(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> RingReserveSkillEquipment:
    return await _get(
        client,
        "/maplestory/v1/character/ring-reserve-skill-equipment",
        RingReserveSkillEquipment,
        ocid,
        date,
    )


# Nexon retired ring-exchange-skill-equipment and replaced it with
# ring-reserve-skill-equipment as of this date; querying either endpoint for
# a date on the wrong side of the cutover returns a 400.
RING_SKILL_EQUIPMENT_CUTOVER_DATE = _date(2026, 3, 19)


async def get_character_ring_skill_equipment(
    client: NexonApiClient, ocid: str, date: str | None = None
) -> RingExchangeSkillEquipment | RingReserveSkillEquipment:
    """Calls whichever of the two special-ring endpoints is valid for ``date``
    (or today, if ``date`` is omitted) — see ``RING_SKILL_EQUIPMENT_CUTOVER_DATE``."""
    query_date = _date.fromisoformat(date) if date else datetime.now(_KST).date()
    if query_date < RING_SKILL_EQUIPMENT_CUTOVER_DATE:
        return await _get_character_ring_exchange_skill_equipment(client, ocid, date)
    return await _get_character_ring_reserve_skill_equipment(client, ocid, date)
