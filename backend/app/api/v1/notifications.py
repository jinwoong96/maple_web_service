from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.notification import NotificationChannel
from app.schemas.notification import (
    NotificationChannelCreate,
    NotificationChannelEntry,
    NotificationCheckResponse,
    NotificationEntry,
    NotificationTargetCreate,
    NotificationTargetEntry,
    NotificationTargetListResponse,
)
from app.services.nexon.client import NexonApiClient
from app.services.nexon.deps import get_nexon_client
from app.services.notification import service as notification_service
from app.services.notification.detectors import DetectedNotification
from app.services.notification.notifier import resolve_notifier

router = APIRouter(prefix="/notifications", tags=["notifications"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
NexonDep = Annotated[NexonApiClient, Depends(get_nexon_client)]


async def get_channel(
    db: DbDep,
    x_notification_key: Annotated[str | None, Header()] = None,
) -> NotificationChannel:
    """웹훅 등록 때 받은 키로 "누구의" 알림인지 가른다. 로그인이 없는
    서비스라 이 키가 곧 신원이다."""
    return await notification_service.get_channel(db, x_notification_key)


ChannelDep = Annotated[NotificationChannel, Depends(get_channel)]


def _to_entry(notification: DetectedNotification) -> NotificationEntry:
    return NotificationEntry(
        item_type=notification.item_type,
        character_name=notification.character_name,
        title=notification.title,
        message=notification.message,
        meso_cost=notification.meso_cost,
        ready_now=notification.ready_now,
    )


def _to_channel_entry(channel: NotificationChannel) -> NotificationChannelEntry:
    return NotificationChannelEntry(
        access_key=channel.access_key,
        webhook_url_masked=notification_service.mask_webhook_url(channel.webhook_url),
    )


@router.post("/channels", status_code=201)
async def register_channel(
    db: DbDep, payload: NotificationChannelCreate
) -> NotificationChannelEntry:
    """웹훅을 등록하고 키를 받는다. 이미 등록된 URL이면 같은 키가 나온다."""
    channel = await notification_service.register_channel(db, payload.webhook_url)
    await db.commit()
    return _to_channel_entry(channel)


@router.get("/channels/me")
async def get_my_channel(channel: ChannelDep) -> NotificationChannelEntry:
    return _to_channel_entry(channel)


@router.delete("/channels/me", status_code=204)
async def remove_my_channel(db: DbDep, channel: ChannelDep) -> None:
    """등록 해제. 대상과 발송 기록도 같이 지워진다."""
    await notification_service.remove_channel(db, channel)
    await db.commit()


@router.get("/targets")
async def list_targets(
    db: DbDep,
    channel: ChannelDep,
    item_type: Annotated[str | None, Query(description="항목으로 거르기")] = None,
) -> NotificationTargetListResponse:
    targets = await notification_service.list_targets(db, channel, item_type)
    return NotificationTargetListResponse(
        targets=[
            NotificationTargetEntry(
                id=target.id, item_type=target.item_type, character_name=target.character_name
            )
            for target in targets
        ]
    )


@router.post("/targets", status_code=201)
async def add_target(
    db: DbDep, channel: ChannelDep, payload: NotificationTargetCreate
) -> NotificationTargetEntry:
    target = await notification_service.add_target(
        db, channel, payload.item_type, payload.character_name
    )
    await db.commit()
    return NotificationTargetEntry(
        id=target.id, item_type=target.item_type, character_name=target.character_name
    )


@router.delete("/targets/{target_id}", status_code=204)
async def remove_target(db: DbDep, channel: ChannelDep, target_id: int) -> None:
    await notification_service.remove_target(db, channel, target_id)
    await db.commit()


@router.post("/check")
async def check(
    db: DbDep,
    client: NexonDep,
    channel: ChannelDep,
    send: Annotated[bool, Query(description="true면 실제로 발송까지 한다")] = False,
) -> NotificationCheckResponse:
    """내 채널에 등록된 대상을 전부 검사한다.

    `send=false`(기본)면 미리보기만 하고 발송 횟수도 올리지 않는다.
    """
    result = await notification_service.run_check(
        db, client, channel, resolve_notifier(channel), send=send
    )
    return NotificationCheckResponse(
        detected=[_to_entry(n) for n in result.detected],
        suppressed=[_to_entry(n) for n in result.suppressed],
        sent=[_to_entry(n) for n in result.sent],
        failures=result.failures,
    )
