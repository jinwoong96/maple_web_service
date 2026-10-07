"""One-off crawler: samples characters from the overall ranking across a
spread of pages, reads their equipped items (current set + all 3 presets),
and upserts `item_name -> base_equipment_level` into `item_level_reference`.

Why: Nexon's Probability history endpoints (스타포스/잠재능력/큐브) don't
return an item's required level, so the frontend's 스타포스 cost estimate
(see docs/planning/features/probability.md) has nowhere else to get it. An
item's level requirement is fixed game data — once seen on any one
character wearing it, it's correct for every character forever, so this
only needs to run occasionally (not on every deploy, not scheduled).

Usage (from backend/ — `-m`, not a file path, so `app`/`scripts` resolve as
packages relative to the current directory):
    uv run python -m scripts.crawl_item_levels
    uv run python -m scripts.crawl_item_levels --pages 1,50,200,1000 --per-page 10

Sequential, not parallel — this shares the same Nexon API key as the rest
of the app, and there's no confirmed safe concurrency limit for it.
"""

import argparse
import asyncio
import io
import sys
from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.db.session import async_session_factory
from app.services import item_level as item_level_service
from app.services.nexon.character import get_character_item_equipment, get_ocid
from app.services.nexon.client import NexonApiClient
from app.services.nexon.exceptions import NexonApiError
from app.services.nexon.ranking import get_ranking_overall
from app.services.nexon.schemas.character import CharacterItemEquipment, ItemEquipmentPiece

# An arbitrary spread from the top of the leaderboard to deep into it, to
# get item-level diversity across the whole progression range rather than
# just endgame gear. Not derived from anything — adjust freely per run.
DEFAULT_PAGES = [1, 20, 50, 100, 200, 400, 800, 1500, 3000, 5000]
DEFAULT_PER_PAGE = 20


def kst_yesterday() -> str:
    kst_now = datetime.now(UTC) + timedelta(hours=9)
    return (kst_now - timedelta(days=1)).strftime("%Y-%m-%d")


def all_equipment_pieces(item_equipment: CharacterItemEquipment) -> list[ItemEquipmentPiece]:
    """Current set + all 3 presets — presets often carry different items
    than what's currently worn, so including them multiplies the distinct
    items discovered per character crawled for free (one API call already
    returns all four)."""
    return [
        *item_equipment.item_equipment,
        *item_equipment.item_equipment_preset_1,
        *item_equipment.item_equipment_preset_2,
        *item_equipment.item_equipment_preset_3,
    ]


async def crawl(pages: list[int], per_page: int) -> None:
    date = kst_yesterday()
    seen_characters = 0
    seen_items = 0

    async with (
        NexonApiClient(
            api_key=settings.nexon_api_key, base_url=settings.nexon_api_base_url
        ) as client,
        async_session_factory() as session,
    ):
        for page in pages:
            try:
                ranking = await get_ranking_overall(client, date, page=page)
            except NexonApiError as error:
                print(f"[page {page}] 랭킹 조회 실패: {error}")
                continue

            names = [entry.character_name for entry in ranking.ranking[:per_page]]
            print(f"[page {page}] {len(names)}명 크롤링 시작")

            for name in names:
                try:
                    ocid = await get_ocid(client, name)
                    equipment = await get_character_item_equipment(client, ocid)
                except NexonApiError as error:
                    print(f"  {name}: 조회 실패 ({error})")
                    continue

                seen_characters += 1
                for piece in all_equipment_pieces(equipment):
                    level = (
                        piece.item_base_option.base_equipment_level
                        if piece.item_base_option
                        else None
                    )
                    if level is None:
                        continue
                    await item_level_service.upsert_item_level(
                        session, piece.item_name, level, piece.item_icon, name
                    )
                    seen_items += 1

            await session.commit()
            print(
                f"[page {page}] 완료 — 누적 캐릭터 {seen_characters}명, "
                f"아이템 레코드 {seen_items}건"
            )

    print(f"크롤링 완료: 캐릭터 {seen_characters}명, 아이템 레코드 {seen_items}건")


def main() -> None:
    # Windows' console defaults stdout to the system codepage (cp949 on a
    # Korean machine), which can't encode plain-ASCII-adjacent punctuation
    # like em dashes once mixed with Korean text in the same f-string —
    # force UTF-8 so this prints correctly regardless of terminal.
    if isinstance(sys.stdout, io.TextIOWrapper):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(
        description="랭킹 상위 캐릭터를 크롤링해 아이템 레벨 참조 테이블을 채운다."
    )
    parser.add_argument(
        "--pages",
        type=str,
        default=",".join(str(p) for p in DEFAULT_PAGES),
        help="쉼표로 구분한 랭킹 페이지 번호 목록",
    )
    parser.add_argument(
        "--per-page", type=int, default=DEFAULT_PER_PAGE, help="페이지당 크롤링할 캐릭터 수"
    )
    args = parser.parse_args()

    pages = [int(page) for page in args.pages.split(",") if page]
    asyncio.run(crawl(pages, args.per_page))


if __name__ == "__main__":
    main()
