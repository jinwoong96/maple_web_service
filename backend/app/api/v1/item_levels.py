from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.item_level import ItemLevelEntry, ItemLevelLookupResponse
from app.services import item_level as item_level_service

router = APIRouter(prefix="/item-levels", tags=["item-levels"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("")
async def lookup_item_levels(
    db: DbDep,
    names: Annotated[list[str], Query(description="조회할 아이템 이름 목록")],
) -> ItemLevelLookupResponse:
    rows = await item_level_service.get_item_levels(db, names)
    return ItemLevelLookupResponse(
        items=[
            ItemLevelEntry(
                item_name=row.item_name,
                base_equipment_level=row.base_equipment_level,
                item_icon=row.item_icon,
            )
            for row in rows
        ]
    )
