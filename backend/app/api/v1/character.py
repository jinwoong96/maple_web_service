from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.schemas.common import OcidResponse
from app.services.nexon import character as character_service
from app.services.nexon.client import NexonApiClient
from app.services.nexon.deps import get_nexon_client
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

router = APIRouter(prefix="/characters", tags=["character"])

DateQuery = Annotated[str | None, Query(description="KST 날짜 (YYYY-MM-DD), 생략 시 최신 데이터")]
ClientDep = Annotated[NexonApiClient, Depends(get_nexon_client)]


@router.get("/ocid")
async def get_ocid(character_name: str, client: ClientDep) -> OcidResponse:
    ocid = await character_service.get_ocid(client, character_name)
    return OcidResponse(ocid=ocid)


@router.get("/{ocid}/basic")
async def get_character_basic(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterBasic:
    return await character_service.get_character_basic(client, ocid, date)


@router.get("/{ocid}/popularity")
async def get_character_popularity(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterPopularity:
    return await character_service.get_character_popularity(client, ocid, date)


@router.get("/{ocid}/stat")
async def get_character_stat(ocid: str, client: ClientDep, date: DateQuery = None) -> CharacterStat:
    return await character_service.get_character_stat(client, ocid, date)


@router.get("/{ocid}/hyper-stat")
async def get_character_hyper_stat(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterHyperStat:
    return await character_service.get_character_hyper_stat(client, ocid, date)


@router.get("/{ocid}/propensity")
async def get_character_propensity(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterPropensity:
    return await character_service.get_character_propensity(client, ocid, date)


@router.get("/{ocid}/ability")
async def get_character_ability(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterAbility:
    return await character_service.get_character_ability(client, ocid, date)


@router.get("/{ocid}/item-equipment")
async def get_character_item_equipment(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterItemEquipment:
    return await character_service.get_character_item_equipment(client, ocid, date)


@router.get("/{ocid}/cashitem-equipment")
async def get_character_cashitem_equipment(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterCashItemEquipment:
    return await character_service.get_character_cashitem_equipment(client, ocid, date)


@router.get("/{ocid}/symbol-equipment")
async def get_character_symbol_equipment(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterSymbolEquipment:
    return await character_service.get_character_symbol_equipment(client, ocid, date)


@router.get("/{ocid}/set-effect")
async def get_character_set_effect(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterSetEffect:
    return await character_service.get_character_set_effect(client, ocid, date)


@router.get("/{ocid}/beauty-equipment")
async def get_character_beauty_equipment(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterBeautyEquipment:
    return await character_service.get_character_beauty_equipment(client, ocid, date)


@router.get("/{ocid}/android-equipment")
async def get_character_android_equipment(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterAndroidEquipment:
    return await character_service.get_character_android_equipment(client, ocid, date)


@router.get("/{ocid}/pet-equipment")
async def get_character_pet_equipment(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterPetEquipment:
    return await character_service.get_character_pet_equipment(client, ocid, date)


@router.get("/{ocid}/skill")
async def get_character_skill(
    ocid: str,
    character_skill_grade: str,
    client: ClientDep,
    date: DateQuery = None,
) -> CharacterSkill:
    return await character_service.get_character_skill(client, ocid, character_skill_grade, date)


@router.get("/{ocid}/link-skill")
async def get_character_link_skill(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterLinkSkill:
    return await character_service.get_character_link_skill(client, ocid, date)


@router.get("/{ocid}/vmatrix")
async def get_character_vmatrix(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterVMatrix:
    return await character_service.get_character_vmatrix(client, ocid, date)


@router.get("/{ocid}/hexamatrix")
async def get_character_hexamatrix(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterHexaMatrix:
    return await character_service.get_character_hexamatrix(client, ocid, date)


@router.get("/{ocid}/hexamatrix-stat")
async def get_character_hexamatrix_stat(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterHexaMatrixStat:
    return await character_service.get_character_hexamatrix_stat(client, ocid, date)


@router.get("/{ocid}/dojang")
async def get_character_dojang(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterDojang:
    return await character_service.get_character_dojang(client, ocid, date)


@router.get("/{ocid}/other-stat")
async def get_character_other_stat(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> CharacterOtherStat:
    return await character_service.get_character_other_stat(client, ocid, date)


@router.get("/{ocid}/ring-skill-equipment")
async def get_character_ring_skill_equipment(
    ocid: str, client: ClientDep, date: DateQuery = None
) -> RingExchangeSkillEquipment | RingReserveSkillEquipment:
    return await character_service.get_character_ring_skill_equipment(client, ocid, date)
