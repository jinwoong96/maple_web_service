from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item_level_reference import ItemLevelReference


async def get_item_levels(session: AsyncSession, item_names: list[str]) -> list[ItemLevelReference]:
    if not item_names:
        return []
    # `populate_existing` matters because `upsert_item_level` writes via a
    # Core `INSERT ... ON CONFLICT`, which the ORM's identity map doesn't
    # know happened — without it, a `get_item_levels` call in the same
    # session (e.g. the crawler script, which reuses one session across
    # many upserts) can return a stale in-memory copy of a row this same
    # session already upserted, since `expire_on_commit=False` (see
    # app/db/session.py) never forces a refresh on its own.
    result = await session.execute(
        select(ItemLevelReference)
        .where(ItemLevelReference.item_name.in_(item_names))
        .execution_options(populate_existing=True)
    )
    return list(result.scalars().all())


async def upsert_item_level(
    session: AsyncSession,
    item_name: str,
    base_equipment_level: int,
    item_icon: str | None,
    sample_character_name: str | None,
) -> None:
    """An item's required level is a fixed game-data fact, so a later crawl
    hit for the same `item_name` just refreshes `item_icon`/
    `sample_character_name`/`updated_at` — `base_equipment_level` should
    never actually change, but is still overwritten rather than left
    untouched in case a past crawl recorded it wrong."""
    stmt = insert(ItemLevelReference).values(
        item_name=item_name,
        base_equipment_level=base_equipment_level,
        item_icon=item_icon,
        sample_character_name=sample_character_name,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[ItemLevelReference.item_name],
        set_={
            "base_equipment_level": stmt.excluded.base_equipment_level,
            "item_icon": stmt.excluded.item_icon,
            "sample_character_name": stmt.excluded.sample_character_name,
        },
    )
    await session.execute(stmt)
