from fastapi import APIRouter

from app.api.v1 import (
    battle_practice,
    character,
    guild,
    health,
    item_levels,
    notice,
    notifications,
    ranking,
    union,
)

router = APIRouter()
router.include_router(health.router)
router.include_router(character.router)
router.include_router(union.router)
router.include_router(guild.router)
router.include_router(battle_practice.router)
router.include_router(ranking.router)
router.include_router(notice.router)
router.include_router(item_levels.router)
router.include_router(notifications.router)
