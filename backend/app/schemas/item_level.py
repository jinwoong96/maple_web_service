from pydantic import BaseModel


class ItemLevelEntry(BaseModel):
    item_name: str
    base_equipment_level: int
    item_icon: str | None = None


class ItemLevelLookupResponse(BaseModel):
    items: list[ItemLevelEntry]
