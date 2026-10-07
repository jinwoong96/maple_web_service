"""알림 감지 — 넥슨 응답을 받아 "보낼 알림"을 만들어내는 순수 로직.

발송 수단과 완전히 분리돼 있다. 여기서는 보낼 내용만 만들고, 실제로 어디로
보낼지는 `notifier.py`가 정한다.
"""

from dataclasses import dataclass
from datetime import datetime

from app.services.nexon.schemas.common import SymbolEquipment
from app.services.nexon.schemas.union import UnionArtifactCrystal
from app.services.notification.daily_quest_bonus import DailySymbolBonus, get_daily_bonus
from app.services.notification.symbol_reference import (
    get_daily_growth_gain,
    get_required_growth,
    get_upgrade_cost,
)

ITEM_TYPE_SYMBOL_GROWTH = "symbol_growth"
ITEM_TYPE_ARTIFACT_EXPIRY = "artifact_expiry"

ITEM_TYPES = (ITEM_TYPE_SYMBOL_GROWTH, ITEM_TYPE_ARTIFACT_EXPIRY)


@dataclass(frozen=True)
class DetectedNotification:
    item_type: str
    character_name: str
    #: 같은 사건인지 가르는 키. 이 값이 같으면 발송 횟수 상한을 공유한다.
    dedupe_key: str
    title: str
    message: str
    #: 이 알림대로 강화하는 데 드는 메소. 비용을 모르거나 해당 없으면 `None`.
    meso_cost: int | None = None
    #: 심볼업이 지금 바로 가능한지(일퀘 없이). 비용 합계를 "지금 밀린 것"과
    #: "일퀘 후 포함"으로 가르는 데 쓴다.
    ready_now: bool = False


def format_meso(amount: int) -> str:
    """`1_188_000_000` → `"11억 8,800만"`. 강화 비용은 만 단위 아래가 늘 0이다."""
    eok, man = divmod(amount // 10_000, 10_000)
    if eok and man:
        return f"{eok:,}억 {man:,}만"
    if eok:
        return f"{eok:,}억"
    return f"{man:,}만"


def _level_up_plan(
    symbol_name: str, level: int, growth: int, require: int
) -> tuple[int, int | None]:
    """성장치 `growth`로 몇 레벨까지 올릴 수 있고 그 비용이 얼마인지.

    성장치가 요구치를 몇 배 넘기면 한 번에 여러 레벨을 올릴 수 있다(남는
    성장치는 이월된다). 현재 레벨의 요구치는 넥슨 응답 값을 쓰고, 그 다음
    레벨부터는 기준표로 이어간다. 비용을 모르는 레벨이 하나라도 있으면 합계는
    `None`.
    """
    cost: int | None = 0
    current_require: int | None = require
    while current_require is not None and growth >= current_require:
        step = get_upgrade_cost(symbol_name, level)
        cost = None if cost is None or step is None else cost + step
        growth -= current_require
        level += 1
        current_require = get_required_growth(symbol_name, level)
    return level, cost


def detect_symbol_growth(
    character_name: str,
    symbols: list[SymbolEquipment],
    daily_bonuses: list[DailySymbolBonus] | None = None,
) -> list[DetectedNotification]:
    """지금 바로 올릴 수 있거나, 일퀘 한 번이면 올릴 수 있는 심볼을 찾는다.

    가장 최근 스냅샷을 받아서 (1) 이미 요구치를 넘긴 심볼과 (2) 일일 퀘스트
    1회분을 더하면 요구치에 닿는 심볼을 문구를 나눠 알린다. 오늘 일퀘를
    했는지는 사용자 본인이 아니까 따지지 않는다. 성장치 계산 근거가 없는
    심볼(아케인/어센틱이 아닌 것)은 건너뛴다. 올리는 데 드는 메소도 같이 싣는다.
    `daily_bonuses`는 이벤트 스킬이 일퀘 1회분에 더해주는 개수다.

    `dedupe_key`에 레벨을 넣어서, 실제로 심볼업을 하면 다음 레벨은 새 알림이
    된다(발송 횟수가 새로 시작).
    """
    detected: list[DetectedNotification] = []
    for symbol in symbols:
        name = symbol.symbol_name
        level = symbol.symbol_level
        growth = symbol.symbol_growth_count
        require = symbol.symbol_require_growth_count
        if growth is None or require is None or require <= 0:
            continue
        base_gain = get_daily_growth_gain(name)
        if base_gain is None:
            continue
        bonus = get_daily_bonus(name, daily_bonuses or [])
        gain = base_gain + bonus
        if growth + gain < require:
            continue

        ready_now = growth >= require
        target_level, cost = _level_up_plan(
            name, level, growth if ready_now else growth + gain, require
        )
        reach = f"Lv.{target_level}까지" if target_level > level + 1 else f"Lv.{target_level}"
        cost_text = f", 강화 비용 {format_meso(cost)} 메소" if cost else ""
        gain_text = f"+{gain}, 이벤트 +{bonus} 포함" if bonus else f"+{gain}"
        detail = (
            f"이미 {growth}/{require} 달성 → {reach}{cost_text}"
            if ready_now
            else f"{growth}/{require}, 일퀘 1회({gain_text})면 달성 → {reach}{cost_text}"
        )
        detected.append(
            DetectedNotification(
                item_type=ITEM_TYPE_SYMBOL_GROWTH,
                character_name=character_name,
                dedupe_key=f"{name}|lv{level}",
                title=f"{character_name} — 심볼업!",
                message=f"{name} Lv.{level} · {detail}",
                meso_cost=cost,
                ready_now=ready_now,
            )
        )
    return detected


def detect_artifact_expiry(
    character_name: str,
    crystals: list[UnionArtifactCrystal],
    now: datetime,
    warning_days: int,
) -> list[DetectedNotification]:
    """유니온 아티팩트 크리스탈 만료가 `warning_days` 이내면 알린다.

    크리스탈 여러 개가 보통 같은 만료 일시를 공유하지만 그렇지 않을 수도
    있어서, 가장 이른 만료를 기준으로 한 건만 만든다. 이미 만료된 것도
    (남은 일수 0 이하) 알린다 — 연장하라는 뜻은 같기 때문이다.

    `dedupe_key`가 만료 일시라서, 연장하면 새 알림으로 취급된다.
    """
    expiries = [c.date_expire for c in crystals if c.date_expire]
    if not expiries:
        return []

    earliest_raw = min(expiries)
    try:
        earliest = datetime.fromisoformat(earliest_raw)
    except ValueError:
        return []

    remaining_days = (earliest - now).total_seconds() / 86400
    if remaining_days > warning_days:
        return []

    when = earliest.strftime("%Y-%m-%d %H:%M")
    detail = (
        f"이미 만료됐어요 (만료 {when})."
        if remaining_days < 0
        else f"{remaining_days:.1f}일 남았어요 (만료 {when})."
    )
    return [
        DetectedNotification(
            item_type=ITEM_TYPE_ARTIFACT_EXPIRY,
            character_name=character_name,
            dedupe_key=earliest_raw,
            title=f"{character_name} — 유니온 아티팩트 연장하세요!",
            message=detail,
        )
    ]
