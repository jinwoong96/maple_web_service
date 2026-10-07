"""알림 채널/대상 관리와 검사/발송 오케스트레이션."""

import logging
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.notification import NotificationChannel, NotificationDispatch, NotificationTarget
from app.services.nexon.character import (
    get_character_skill,
    get_character_symbol_equipment,
    get_ocid,
)
from app.services.nexon.client import NexonApiClient
from app.services.nexon.union import get_union_artifact
from app.services.notification.daily_quest_bonus import (
    DailySymbolBonus,
    parse_daily_symbol_bonuses,
)
from app.services.notification.detectors import (
    ITEM_TYPE_ARTIFACT_EXPIRY,
    ITEM_TYPE_SYMBOL_GROWTH,
    ITEM_TYPES,
    DetectedNotification,
    detect_artifact_expiry,
    detect_symbol_growth,
)
from app.services.notification.exceptions import (
    NotificationInvalidInput,
    NotificationNotFound,
    NotificationUnauthorized,
)
from app.services.notification.notifier import Notifier

logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))

#: 디스코드 웹훅만 받는다. 아무 URL이나 받으면 서버가 남의 주소로 요청을
#: 보내주는 통로(SSRF)가 되기 때문이다.
_DISCORD_WEBHOOK_PATTERN = re.compile(
    r"^https://(?:(?:ptb|canary)\.)?discord(?:app)?\.com/api/webhooks/\d+/[\w-]+/?$"
)


@dataclass
class CheckResult:
    #: 이번에 조건을 만족한 알림 전부(발송 여부와 무관).
    detected: list[DetectedNotification]
    #: 그중 발송 횟수 상한에 걸려 보내지 않은 것.
    suppressed: list[DetectedNotification]
    #: 실제로 발송한 것.
    sent: list[DetectedNotification]
    #: 조회 자체에 실패한 대상 (캐릭터명 -> 사유).
    failures: dict[str, str]


def mask_webhook_url(url: str) -> str:
    """화면에 보여줄 때 토큰 부분을 가린다 — 키만 있으면 URL 전체를 다시
    보여줄 필요가 없다."""
    head, _, token = url.rstrip("/").rpartition("/")
    return f"{head}/{token[:4]}…" if head else url


async def register_channel(db: AsyncSession, webhook_url: str) -> NotificationChannel:
    """웹훅을 등록한다. 이미 있는 URL이면 그 채널을 그대로 돌려준다 —
    다른 기기에서도 URL만 다시 넣으면 같은 대상 목록을 이어서 쓴다."""
    url = webhook_url.strip()
    if not _DISCORD_WEBHOOK_PATTERN.match(url):
        raise NotificationInvalidInput("디스코드 웹훅 URL이 아닙니다.")

    existing = await db.execute(
        select(NotificationChannel).where(NotificationChannel.webhook_url == url)
    )
    found = existing.scalar_one_or_none()
    if found is not None:
        return found

    channel = NotificationChannel(webhook_url=url, access_key=secrets.token_urlsafe(24))
    db.add(channel)
    await db.flush()
    return channel


async def get_channel(db: AsyncSession, access_key: str | None) -> NotificationChannel:
    if not access_key:
        raise NotificationUnauthorized("웹훅을 먼저 등록해주세요.")
    result = await db.execute(
        select(NotificationChannel).where(NotificationChannel.access_key == access_key)
    )
    channel = result.scalar_one_or_none()
    if channel is None:
        raise NotificationUnauthorized("등록되지 않은 채널 키입니다. 웹훅을 다시 등록해주세요.")
    return channel


async def remove_channel(db: AsyncSession, channel: NotificationChannel) -> None:
    """대상과 발송 기록은 FK `ON DELETE CASCADE`로 같이 지워진다."""
    await db.delete(channel)


async def list_targets(
    db: AsyncSession, channel: NotificationChannel, item_type: str | None = None
) -> list[NotificationTarget]:
    stmt = (
        select(NotificationTarget)
        .where(NotificationTarget.channel_id == channel.id)
        .order_by(NotificationTarget.item_type, NotificationTarget.id)
    )
    if item_type:
        stmt = stmt.where(NotificationTarget.item_type == item_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def add_target(
    db: AsyncSession, channel: NotificationChannel, item_type: str, character_name: str
) -> NotificationTarget:
    """이미 있으면 그대로 돌려준다 — 같은 항목에 같은 캐릭터를 두 번 넣어도
    중복 행이 생기지 않게."""
    if item_type not in ITEM_TYPES:
        raise NotificationInvalidInput(f"알 수 없는 알림 항목입니다: {item_type}")
    character_name = character_name.strip()
    if not character_name:
        raise NotificationInvalidInput("캐릭터 이름이 비어 있습니다.")

    existing = await db.execute(
        select(NotificationTarget).where(
            NotificationTarget.channel_id == channel.id,
            NotificationTarget.item_type == item_type,
            NotificationTarget.character_name == character_name,
        )
    )
    found = existing.scalar_one_or_none()
    if found is not None:
        return found

    target = NotificationTarget(
        channel_id=channel.id, item_type=item_type, character_name=character_name
    )
    db.add(target)
    await db.flush()
    return target


async def remove_target(db: AsyncSession, channel: NotificationChannel, target_id: int) -> None:
    target = await db.get(NotificationTarget, target_id)
    # 남의 채널 대상은 없는 것과 똑같이 취급한다 — 있다는 사실도 흘리지 않게.
    if target is None or target.channel_id != channel.id:
        raise NotificationNotFound("등록되지 않은 대상입니다.")
    await db.delete(target)


async def _resolve_ocid(
    db: AsyncSession, client: NexonApiClient, target: NotificationTarget
) -> str:
    if target.ocid:
        return target.ocid
    ocid = await get_ocid(client, target.character_name)
    target.ocid = ocid
    return ocid


async def _get_daily_symbol_bonuses(
    client: NexonApiClient, character_name: str, ocid: str
) -> list[DailySymbolBonus]:
    """초보자 스킬(0차)에 들어온 이벤트 스킬의 일퀘 심볼 추가분.

    추가분은 덤이라, 스킬 조회가 실패해도 심볼 알림은 기본 성장치로 계속
    보낸다.
    """
    try:
        skills = await get_character_skill(client, ocid, character_skill_grade="0")
    except Exception as exc:  # noqa: BLE001 - 덤 정보 때문에 심볼 알림을 멈추지 않는다
        logger.warning("%s 초보자 스킬 조회 실패, 이벤트 추가분 없이 계산: %s", character_name, exc)
        return []
    return parse_daily_symbol_bonuses(skills.character_skill)


async def _detect_for_target(
    db: AsyncSession, client: NexonApiClient, target: NotificationTarget
) -> list[DetectedNotification]:
    """날짜 없이 불러서 넥슨의 가장 최근 스냅샷을 본다.

    예전에는 "어제 상태 + 오늘 일퀘 1회"를 판단하려고 어제 날짜를 넘겼는데,
    오늘 일퀘를 했는지는 사용자 본인이 아니까 최신 값에서 "이미 달성 /
    일퀘 1회면 달성"만 알려주는 편이 낫다(사용자 결정, 2026-09-28).
    """
    ocid = await _resolve_ocid(db, client, target)

    if target.item_type == ITEM_TYPE_SYMBOL_GROWTH:
        symbols = await get_character_symbol_equipment(client, ocid)
        bonuses = await _get_daily_symbol_bonuses(client, target.character_name, ocid)
        return detect_symbol_growth(target.character_name, symbols.symbol, bonuses)

    if target.item_type == ITEM_TYPE_ARTIFACT_EXPIRY:
        artifact = await get_union_artifact(client, ocid)
        return detect_artifact_expiry(
            target.character_name,
            artifact.union_artifact_crystal,
            datetime.now(KST),
            settings.artifact_expiry_warning_days,
        )

    logger.warning("알 수 없는 알림 항목: %s", target.item_type)
    return []


async def _get_dispatch(
    db: AsyncSession, channel: NotificationChannel, notification: DetectedNotification
) -> NotificationDispatch:
    result = await db.execute(
        select(NotificationDispatch).where(
            NotificationDispatch.channel_id == channel.id,
            NotificationDispatch.item_type == notification.item_type,
            NotificationDispatch.character_name == notification.character_name,
            NotificationDispatch.dedupe_key == notification.dedupe_key,
        )
    )
    dispatch = result.scalar_one_or_none()
    if dispatch is None:
        dispatch = NotificationDispatch(
            channel_id=channel.id,
            item_type=notification.item_type,
            character_name=notification.character_name,
            dedupe_key=notification.dedupe_key,
            sent_count=0,
        )
        db.add(dispatch)
        await db.flush()
    return dispatch


async def run_check(
    db: AsyncSession,
    client: NexonApiClient,
    channel: NotificationChannel,
    notifier: Notifier,
    *,
    send: bool,
) -> CheckResult:
    """채널(사람) 하나에 등록된 대상을 전부 검사하고, `send`면 상한에 걸리지
    않은 것만 그 채널로 발송한다.

    한 대상의 조회 실패가 나머지를 막지 않는다 — 실패는 `failures`에 모아
    돌려주고 나머지는 그대로 진행한다.
    """
    targets = await list_targets(db, channel)

    detected: list[DetectedNotification] = []
    failures: dict[str, str] = {}
    for target in targets:
        try:
            detected.extend(await _detect_for_target(db, client, target))
        except Exception as exc:  # noqa: BLE001 - 대상 하나의 실패로 전체를 멈추지 않는다
            logger.warning("%s 알림 검사 실패: %s", target.character_name, exc)
            failures[f"{target.character_name}({target.item_type})"] = str(exc)

    # 이번에 보낼 것 전부를 한 메시지로 묶어서 보낸다. 캐릭터별로 쪼개서
    # 보내본 적도 있는데(2026-09-23), 알림이 여러 개로 흩어지는 것보다 한 번에
    # 모여서 오는 편이 낫다고 해서 되돌렸다. 메시지 안에서는 제목(캐릭터 +
    # 항목)별로 블록이 나뉘어 있어서 누구 것인지 구분된다.
    sendable: list[DetectedNotification] = []
    suppressed: list[DetectedNotification] = []
    dispatches: list[NotificationDispatch] = []
    for notification in detected:
        dispatch = await _get_dispatch(db, channel, notification)
        if dispatch.sent_count >= settings.notification_max_send_count:
            suppressed.append(notification)
            continue
        sendable.append(notification)
        dispatches.append(dispatch)

    sent: list[DetectedNotification] = []
    if send and sendable and await notifier.send(sendable):
        sent = sendable
        for dispatch in dispatches:
            dispatch.sent_count += 1
            dispatch.last_sent_at = datetime.now(UTC)

    await db.commit()
    return CheckResult(detected=detected, suppressed=suppressed, sent=sent, failures=failures)
