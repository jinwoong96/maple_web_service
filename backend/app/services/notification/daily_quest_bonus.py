"""이벤트 스킬의 "일일퀘스트 완료 시 획득 심볼 N개 증가" 효과 읽기.

이벤트 기간에는 초보자 스킬(넥슨 `character/skill`의 0차)에 이벤트 스킬이
들어오고, 그중 일퀘 심볼 보상을 늘려주는 것이 있다. 스킬 이름은 이벤트마다
바뀌므로("아르고 호의 가호" 등) 이름이 아니라 효과 문구로 찾는다.

넥슨 응답에서 확인한 문구(2026-10-06, 다섯별·눈사람이의 "아르고 호의 가호"
`skill_effect`):

    그란디스 일일퀘스트 완료 시 획득 경험치 10%, 획득 심볼 3개 증가

문구 앞의 지역 이름이 아는 지역(그란디스/아케인리버)이면 그 지역 심볼에만
더하고, 지역이 없거나 모르는 말이면 모든 심볼에 더한다.
"""

import re
from dataclasses import dataclass

from app.services.nexon.schemas.common import SkillInfo
from app.services.notification.symbol_reference import (
    ARCANE_AREA,
    GRANDIS_AREA,
    get_symbol_area,
)

#: 효과는 한 줄에 하나씩이라 줄 단위로 찾는다. 그룹 1은 그 줄에서 "일일퀘스트"
#: 앞부분 — 지역 이름이 여기 들어 있다.
_BONUS_PATTERN = re.compile(
    r"^([^\n]*?)일일\s*퀘스트 완료 시[^\n]*?획득 심볼\s*(\d+)\s*개 증가", re.MULTILINE
)

_KNOWN_AREAS = (ARCANE_AREA, GRANDIS_AREA)


@dataclass(frozen=True)
class DailySymbolBonus:
    skill_name: str
    amount: int
    #: `ARCANE_AREA`/`GRANDIS_AREA`, 지역 구분 없이 모든 심볼이면 `None`.
    area: str | None


def parse_daily_symbol_bonuses(skills: list[SkillInfo]) -> list[DailySymbolBonus]:
    bonuses: list[DailySymbolBonus] = []
    for skill in skills:
        for match in _BONUS_PATTERN.finditer(skill.skill_effect or ""):
            prefix = match.group(1).replace(" ", "")
            area = next((a for a in _KNOWN_AREAS if a in prefix), None)
            bonuses.append(
                DailySymbolBonus(skill_name=skill.skill_name, amount=int(match.group(2)), area=area)
            )
    return bonuses


def get_daily_bonus(symbol_name: str, bonuses: list[DailySymbolBonus]) -> int:
    """이 심볼에 붙는 이벤트 추가분 합계. 여러 스킬이 겹치면 다 더한다."""
    area = get_symbol_area(symbol_name)
    return sum(b.amount for b in bonuses if b.area is None or b.area == area)
