from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.nexon import notice as notice_service
from app.services.nexon.client import NexonApiClient
from app.services.nexon.deps import get_nexon_client
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

router = APIRouter(prefix="/notices", tags=["notice"])

ClientDep = Annotated[NexonApiClient, Depends(get_nexon_client)]
#: 목록은 담아둔 것을 먼저 본다. 라우터는 그 사실을 몰라도 되지만, 세션은
#: 여기서 받아 넘겨야 한다(`services/nexon/notice.py` 참고).
DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/general")
async def get_notice_list(client: ClientDep, db: DbDep) -> NoticeList:
    return await notice_service.get_notice_list(client, db)


@router.get("/general/{notice_id}")
async def get_notice_detail(notice_id: int, client: ClientDep) -> NoticeDetail:
    return await notice_service.get_notice_detail(client, notice_id)


@router.get("/updates")
async def get_notice_update_list(client: ClientDep, db: DbDep) -> UpdateNoticeList:
    return await notice_service.get_notice_update_list(client, db)


@router.get("/updates/{notice_id}")
async def get_notice_update_detail(notice_id: int, client: ClientDep) -> UpdateNoticeDetail:
    return await notice_service.get_notice_update_detail(client, notice_id)


@router.get("/events")
async def get_notice_event_list(client: ClientDep, db: DbDep) -> EventNoticeList:
    return await notice_service.get_notice_event_list(client, db)


@router.get("/events/{notice_id}")
async def get_notice_event_detail(notice_id: int, client: ClientDep) -> EventNoticeDetail:
    return await notice_service.get_notice_event_detail(client, notice_id)


@router.get("/cashshop")
async def get_notice_cashshop_list(client: ClientDep, db: DbDep) -> CashshopNoticeList:
    return await notice_service.get_notice_cashshop_list(client, db)


@router.get("/cashshop/{notice_id}")
async def get_notice_cashshop_detail(notice_id: int, client: ClientDep) -> CashshopNoticeDetail:
    return await notice_service.get_notice_cashshop_detail(client, notice_id)
