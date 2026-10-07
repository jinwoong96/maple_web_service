"""Endpoint functions for the Nexon Open API "공지사항 조회" (Notice) category.

List endpoints take no parameters beyond the API key; detail endpoints take
the ``notice_id`` from the corresponding list entry.

**목록 넷은 담아 두고 다시 쓴다**(`cache.py`). 매개변수가 없어서 열쇠가 하나로
정해지고, 홈 화면이 누구나 열자마자 넷을 다 부르기 때문이다. 상세는 담지
않는다 — `notice_id`마다 갈리는 데다 아직 부르는 화면도 없다.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.nexon.cache import cached_response
from app.services.nexon.client import NexonApiClient
from app.services.nexon.schemas.notice import (
    CashshopNoticeDetail,
    CashshopNoticeList,
    EventNoticeDetail,
    EventNoticeList,
    NoticeDetail,
    NoticeList,
    UpdateNoticeDetail,
    UpdateNoticeList,
)


async def get_notice_list(client: NexonApiClient, db: AsyncSession) -> NoticeList:
    data = await cached_response(db, "notice:general", lambda: client.get("/maplestory/v1/notice"))
    return NoticeList.model_validate(data)


async def get_notice_detail(client: NexonApiClient, notice_id: int) -> NoticeDetail:
    data = await client.get("/maplestory/v1/notice/detail", {"notice_id": str(notice_id)})
    return NoticeDetail.model_validate(data)


async def get_notice_update_list(client: NexonApiClient, db: AsyncSession) -> UpdateNoticeList:
    data = await cached_response(
        db, "notice:updates", lambda: client.get("/maplestory/v1/notice-update")
    )
    return UpdateNoticeList.model_validate(data)


async def get_notice_update_detail(client: NexonApiClient, notice_id: int) -> UpdateNoticeDetail:
    data = await client.get("/maplestory/v1/notice-update/detail", {"notice_id": str(notice_id)})
    return UpdateNoticeDetail.model_validate(data)


async def get_notice_event_list(client: NexonApiClient, db: AsyncSession) -> EventNoticeList:
    data = await cached_response(
        db, "notice:events", lambda: client.get("/maplestory/v1/notice-event")
    )
    return EventNoticeList.model_validate(data)


async def get_notice_event_detail(client: NexonApiClient, notice_id: int) -> EventNoticeDetail:
    data = await client.get("/maplestory/v1/notice-event/detail", {"notice_id": str(notice_id)})
    return EventNoticeDetail.model_validate(data)


async def get_notice_cashshop_list(client: NexonApiClient, db: AsyncSession) -> CashshopNoticeList:
    data = await cached_response(
        db, "notice:cashshop", lambda: client.get("/maplestory/v1/notice-cashshop")
    )
    return CashshopNoticeList.model_validate(data)


async def get_notice_cashshop_detail(
    client: NexonApiClient, notice_id: int
) -> CashshopNoticeDetail:
    data = await client.get("/maplestory/v1/notice-cashshop/detail", {"notice_id": str(notice_id)})
    return CashshopNoticeDetail.model_validate(data)
