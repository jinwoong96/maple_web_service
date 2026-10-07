"""심볼 기준표 — 일퀘 1회 성장치, 레벨별 요구 성장치, 레벨별 강화 비용.

요구 성장치와 강화 비용은 나무위키 "아케인포스"/"어센틱포스" 문서의 공식이고,
인벤 강화표(2026-06-01)와 지역별 Lv1·최종 레벨 값이 맞는 것을 확인했다
(2026-09-28). 공식을 그대로 옮기면 소수점 오차로 `floor`가 한 칸 어긋나서,
10을 곱한 정수 계수로 계산한다. 값 대조는 `tests/test_notification.py`.

- 요구 성장치: 아케인 `n² + 11`(만렙 20), 어센틱·그랜드 어센틱 `9n² + 20n`(만렙 11).
- 강화 비용(메소): 아케인 `⌊0.1n³ + k·n² + 1.1n + 11k⌋ × 1만`,
  어센틱·그랜드 어센틱 `⌊-5.4n³ + a·n² + b·n⌋ × 10만`. 계수는 지역마다 다르다.

일퀘 1회 성장치는 사용자가 인게임에서 확인한 값이다(2026-10-06): 아케인 40,
어센틱·그랜드 어센틱 15, 세르니움만 30. 이벤트 스킬로 붙는 추가 개수는
`daily_quest_bonus.py`가 따로 더한다. 주간 퀘스트는 이번 범위에서 뺐다.
"""

ARCANE_PREFIX = "아케인심볼"
AUTHENTIC_PREFIX = "어센틱심볼"
GRAND_AUTHENTIC_PREFIX = "그랜드 어센틱심볼"

#: 심볼 계열이 속한 지역 묶음. 이벤트 스킬 문구("그란디스 일일퀘스트 …")가
#: 이 이름으로 대상을 가리킨다.
ARCANE_AREA = "아케인리버"
GRANDIS_AREA = "그란디스"

ARCANE_DAILY_GAIN = 40
#: 그랜드 어센틱심볼도 어센틱과 같다.
AUTHENTIC_DAILY_GAIN = 15
#: 어센틱 중 일퀘 보상이 기본값과 다른 지역.
_AUTHENTIC_DAILY_GAIN_BY_REGION: dict[str, int] = {"세르니움": 30}

ARCANE_MAX_LEVEL = 20
AUTHENTIC_MAX_LEVEL = 11

#: 아케인 비용 공식의 지역 계수 k.
_ARCANE_COST_K: dict[str, int] = {
    "소멸의 여로": 8,
    "츄츄 아일랜드": 10,
    "레헬른": 12,
    "아르카나": 14,
    "모라스": 16,
    "에스페라": 18,
}

#: 어센틱/그랜드 어센틱 비용 공식의 지역 계수 (a×10, b×10).
_AUTHENTIC_COST_AB: dict[str, tuple[int, int]] = {
    "세르니움": (1068, 2640),
    "아르크스": (1230, 3000),
    "오디움": (1392, 3360),
    "도원경": (1554, 3720),
    "아르테리아": (1716, 4080),
    "카르시온": (1878, 4440),
    "탈라하트": (3462, 7960),
    "기어드락": (4272, 9760),
}


def _family(symbol_name: str) -> str | None:
    # 그랜드 어센틱은 요구치 곡선이 어센틱과 같아서 같은 계열로 본다.
    if symbol_name.startswith(ARCANE_PREFIX):
        return ARCANE_PREFIX
    if symbol_name.startswith((GRAND_AUTHENTIC_PREFIX, AUTHENTIC_PREFIX)):
        return AUTHENTIC_PREFIX
    return None


def _region(symbol_name: str) -> str:
    """`"아케인심볼 : 소멸의 여로"` → `"소멸의 여로"`."""
    return symbol_name.partition(":")[2].strip()


def get_symbol_area(symbol_name: str) -> str | None:
    """`ARCANE_AREA` / `GRANDIS_AREA`. 계열을 모르면 `None`."""
    family = _family(symbol_name)
    if family == ARCANE_PREFIX:
        return ARCANE_AREA
    if family == AUTHENTIC_PREFIX:
        return GRANDIS_AREA
    return None


def get_daily_growth_gain(symbol_name: str) -> int | None:
    """이 심볼이 일일 퀘스트 1회로 얻는 기본 성장치(이벤트 추가분 제외).
    아케인/어센틱 어느 쪽도 아니면 `None` — 계산할 근거가 없으니 알림
    대상에서 빼기 위해서다."""
    family = _family(symbol_name)
    if family == ARCANE_PREFIX:
        return ARCANE_DAILY_GAIN
    if family == AUTHENTIC_PREFIX:
        return _AUTHENTIC_DAILY_GAIN_BY_REGION.get(_region(symbol_name), AUTHENTIC_DAILY_GAIN)
    return None


def get_max_level(symbol_name: str) -> int | None:
    family = _family(symbol_name)
    if family == ARCANE_PREFIX:
        return ARCANE_MAX_LEVEL
    if family == AUTHENTIC_PREFIX:
        return AUTHENTIC_MAX_LEVEL
    return None


def get_required_growth(symbol_name: str, level: int) -> int | None:
    """`level`에서 다음 레벨로 올리는 데 필요한 성장치. 만렙이거나 계열을
    모르면 `None`."""
    max_level = get_max_level(symbol_name)
    if max_level is None or not 1 <= level < max_level:
        return None
    if _family(symbol_name) == ARCANE_PREFIX:
        return level * level + 11
    return 9 * level * level + 20 * level


def get_upgrade_cost(symbol_name: str, level: int) -> int | None:
    """`level`에서 다음 레벨로 올리는 강화 비용(메소). 만렙이거나 지역
    계수를 모르면 `None` — 새 지역이 나오면 위 표에 계수만 넣으면 된다."""
    max_level = get_max_level(symbol_name)
    if max_level is None or not 1 <= level < max_level:
        return None
    region = _region(symbol_name)
    n = level
    if _family(symbol_name) == ARCANE_PREFIX:
        k = _ARCANE_COST_K.get(region)
        if k is None:
            return None
        return ((n**3 + 11 * n) // 10 + k * n * n + 11 * k) * 10_000
    ab = _AUTHENTIC_COST_AB.get(region)
    if ab is None:
        return None
    a, b = ab
    return ((-54 * n**3 + a * n * n + b * n) // 10) * 100_000
