from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item_level_reference import ItemLevelReference
from app.services import item_level as item_level_service

TEST_ITEM_NAME = "테스트용 자동화 아이템"


async def _cleanup(session: AsyncSession) -> None:
    await session.execute(delete(ItemLevelReference).where(ItemLevelReference.item_name == TEST_ITEM_NAME))
    await session.commit()


async def test_upsert_and_get_item_levels(db_session: AsyncSession) -> None:
    await _cleanup(db_session)
    try:
        await item_level_service.upsert_item_level(
            db_session, TEST_ITEM_NAME, base_equipment_level=160, item_icon=None, sample_character_name="테스트캐릭터"
        )
        await db_session.commit()

        rows = await item_level_service.get_item_levels(db_session, [TEST_ITEM_NAME])
        assert len(rows) == 1
        assert rows[0].base_equipment_level == 160

        # upsert again with a different level — should overwrite, not duplicate.
        await item_level_service.upsert_item_level(
            db_session, TEST_ITEM_NAME, base_equipment_level=200, item_icon=None, sample_character_name="다른캐릭터"
        )
        await db_session.commit()

        rows = await item_level_service.get_item_levels(db_session, [TEST_ITEM_NAME])
        assert len(rows) == 1
        assert rows[0].base_equipment_level == 200
    finally:
        await _cleanup(db_session)


async def test_get_item_levels_empty_list_returns_empty(db_session: AsyncSession) -> None:
    assert await item_level_service.get_item_levels(db_session, []) == []


async def test_lookup_item_levels_endpoint(api_client: AsyncClient, db_session: AsyncSession) -> None:
    await _cleanup(db_session)
    try:
        await item_level_service.upsert_item_level(
            db_session,
            TEST_ITEM_NAME,
            base_equipment_level=140,
            item_icon="https://example.com/icon.png",
            sample_character_name=None,
        )
        await db_session.commit()

        response = await api_client.get("/api/v1/item-levels", params={"names": [TEST_ITEM_NAME, "존재하지않는아이템"]})

        assert response.status_code == 200
        assert response.json() == {
            "items": [
                {
                    "item_name": TEST_ITEM_NAME,
                    "base_equipment_level": 140,
                    "item_icon": "https://example.com/icon.png",
                }
            ]
        }
    finally:
        await _cleanup(db_session)
