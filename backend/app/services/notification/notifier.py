"""알림 발송 채널.

감지(`detectors.py`)와 발송을 갈라놓은 이유는 채널을 바꿔 끼우기 위해서다.
지금은 디스코드 웹훅 하나뿐이고, 웹훅 URL은 사람(`NotificationChannel`)마다
DB에 들어 있다. 나중에 다른 채널이 생기면 `Notifier`를 구현해서
`resolve_notifier`에 연결하면 된다 — 감지 쪽은 건드릴 필요가 없다.
"""

import logging
from typing import Protocol

import httpx

from app.models.notification import NotificationChannel
from app.services.notification.detectors import DetectedNotification, format_meso

logger = logging.getLogger(__name__)

#: 디스코드 메시지 본문 상한(2000자)보다 넉넉히 아래에서 자른다.
_DISCORD_CONTENT_LIMIT = 1900


class Notifier(Protocol):
    async def send(self, notifications: list[DetectedNotification]) -> bool:
        """보냈으면 True. 보낼 곳이 없거나 실패하면 False —
        호출한 쪽이 발송 횟수를 올릴지 판단하는 데 쓴다."""
        ...


class DiscordWebhookNotifier:
    def __init__(self, webhook_url: str) -> None:
        self._webhook_url = webhook_url

    async def send(self, notifications: list[DetectedNotification]) -> bool:
        if not notifications:
            return False
        content = format_discord_content(notifications)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(self._webhook_url, json={"content": content})
                response.raise_for_status()
        except httpx.HTTPError:
            # 발송 실패는 알림 기능 전체를 죽일 이유가 아니다 — 로그만 남기고
            # 실패로 보고해서, 발송 횟수가 올라가지 않게 한다.
            logger.exception("디스코드 웹훅 발송에 실패했습니다")
            return False
        return True


def cost_summary(notifications: list[DetectedNotification]) -> str | None:
    """한 제목 블록(캐릭터 하나)의 강화 비용 합계 줄.

    "지금 바로 올릴 수 있는 것"의 합이 밀려 있는 비용이고, 일퀘 1회면 되는
    것까지 더한 값을 괄호로 붙인다. 비용이 붙은 알림이 없으면 `None`.
    """
    costs = [n for n in notifications if n.meso_cost]
    if not costs:
        return None
    now = sum(n.meso_cost or 0 for n in costs if n.ready_now)
    total = sum(n.meso_cost or 0 for n in costs)
    if now and now != total:
        return f"밀린 강화 비용 {format_meso(now)} 메소 (일퀘 후 포함 {format_meso(total)})"
    if now:
        return f"밀린 강화 비용 {format_meso(now)} 메소"
    return f"일퀘 후 강화 비용 {format_meso(total)} 메소"


def format_discord_content(notifications: list[DetectedNotification]) -> str:
    """제목이 같은 것끼리 묶어서 제목은 한 번만 쓰고 내용을 불릿으로 단다.

    한 캐릭터의 심볼업이 여러 건이면 제목("눈사람이 — 심볼업!")이 그 수만큼
    반복돼서 읽기 나빴다. 한 캐릭터가 심볼업과 아티팩트 만료를 동시에 가지면
    제목 블록이 두 개 생긴다. 블록 끝에는 강화 비용 합계를 붙인다.
    """
    blocks: dict[str, list[DetectedNotification]] = {}
    for notification in notifications:
        blocks.setdefault(notification.title, []).append(notification)

    sections = []
    for title, grouped in blocks.items():
        lines = [f"· {n.message}" for n in grouped]
        summary = cost_summary(grouped)
        if summary:
            lines.append(f"💰 {summary}")
        body = "\n".join(lines)
        sections.append(f"**{title}**\n{body}")

    content = "\n\n".join(sections)
    if len(content) > _DISCORD_CONTENT_LIMIT:
        content = content[: _DISCORD_CONTENT_LIMIT - 3] + "..."
    return content


def resolve_notifier(channel: NotificationChannel) -> Notifier:
    return DiscordWebhookNotifier(channel.webhook_url)
