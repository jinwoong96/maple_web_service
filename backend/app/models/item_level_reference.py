from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ItemLevelReference(Base):
    """`item_name` -> `base_equipment_level` reference table.

    Nexon's history endpoints (스타포스/잠재능력/큐브) don't return an
    item's required level, so it can't be priced from history data alone.
    This table is built by crawling public character item-equipment lookups
    (see `scripts/crawl_item_levels.py`) — an item's required level is a
    fixed game-data fact, so once seen for one character it's correct for
    every character.
    """

    __tablename__ = "item_level_reference"

    item_name: Mapped[str] = mapped_column(String, primary_key=True)
    base_equipment_level: Mapped[int] = mapped_column(Integer, nullable=False)
    item_icon: Mapped[str | None] = mapped_column(String, nullable=True)
    sample_character_name: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
