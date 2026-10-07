from datetime import datetime, timedelta, timezone

import httpx
import pytest
from httpx import AsyncClient
from respx import MockRouter
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationChannel
from app.services.nexon.schemas.common import SkillInfo, SymbolEquipment
from app.services.nexon.schemas.union import UnionArtifactCrystal
from app.services.notification.daily_quest_bonus import (
    DailySymbolBonus,
    get_daily_bonus,
    parse_daily_symbol_bonuses,
)
from app.services.notification.detectors import (
    ITEM_TYPE_ARTIFACT_EXPIRY,
    ITEM_TYPE_SYMBOL_GROWTH,
    DetectedNotification,
    detect_artifact_expiry,
    detect_symbol_growth,
)
from app.services.notification.exceptions import (
    NotificationInvalidInput,
    NotificationNotFound,
)
from app.services.notification.notifier import format_discord_content
from app.services.notification.service import (
    add_target,
    list_targets,
    mask_webhook_url,
    register_channel,
    remove_target,
)
from app.services.notification.symbol_reference import (
    get_daily_growth_gain,
    get_required_growth,
    get_upgrade_cost,
)

KST = timezone(timedelta(hours=9))
TEST_CHARACTER = "테스트용자동화캐릭터"
#: 테스트 전용 채널. 실제로 보내지는 않는다(가짜 notifier를 쓴다).
TEST_WEBHOOK = "https://discord.com/api/webhooks/1/test-automation-webhook"
OTHER_WEBHOOK = "https://discord.com/api/webhooks/2/test-automation-webhook"


def _symbol(name: str, level: int, growth: int, require: int) -> SymbolEquipment:
    return SymbolEquipment(
        symbol_name=name,
        symbol_level=level,
        symbol_growth_count=growth,
        symbol_require_growth_count=require,
    )


def _crystal(expire: str | None) -> UnionArtifactCrystal:
    return UnionArtifactCrystal(
        name="크리스탈 : 주황버섯", validity_flag="0", date_expire=expire, level=5
    )


# --- 심볼 기준표 -------------------------------------------------------------


def test_daily_gain_by_symbol_family() -> None:
    assert get_daily_growth_gain("아케인심볼 : 소멸의 여로") == 40
    # 세르니움만 어센틱 기본값의 두 배.
    assert get_daily_growth_gain("어센틱심볼 : 세르니움") == 30
    assert get_daily_growth_gain("어센틱심볼 : 아르크스") == 15
    assert get_daily_growth_gain("그랜드 어센틱심볼 : 탈라하트") == 15
    # 근거 없는 이름은 계산에서 빠진다.
    assert get_daily_growth_gain("정체불명 심볼") is None


def test_required_growth_matches_known_tables() -> None:
    arcane = [get_required_growth("아케인심볼 : 레헬른", n) or 0 for n in range(1, 20)]
    assert arcane[0] == 12 and arcane[-1] == 372 and sum(arcane) == 2679
    authentic = [get_required_growth("어센틱심볼 : 오디움", n) or 0 for n in range(1, 11)]
    assert authentic[8] == 909 and sum(authentic) == 4565
    # 만렙에서는 다음 요구치가 없다.
    assert get_required_growth("아케인심볼 : 레헬른", 20) is None
    assert get_required_growth("그랜드 어센틱심볼 : 탈라하트", 11) is None


def _total_cost(name: str, max_level: int) -> int:
    return sum(get_upgrade_cost(name, n) or 0 for n in range(1, max_level))


def test_upgrade_cost_matches_namu_and_inven_tables() -> None:
    """나무위키 표와 인벤 강화표(2026-06-01)에서 확인한 값."""
    assert get_upgrade_cost("아케인심볼 : 소멸의 여로", 1) == 970_000
    assert get_upgrade_cost("아케인심볼 : 소멸의 여로", 19) == 36_820_000
    assert get_upgrade_cost("아케인심볼 : 아르카나", 9) == 13_700_000
    assert _total_cost("아케인심볼 : 에스페라", 20) == 520_370_000
    assert get_upgrade_cost("어센틱심볼 : 세르니움", 1) == 36_500_000
    assert get_upgrade_cost("어센틱심볼 : 세르니움", 10) == 792_000_000
    assert get_upgrade_cost("어센틱심볼 : 아르테리아", 4) == 403_200_000
    assert _total_cost("어센틱심볼 : 카르시온", 11) == 8_038_600_000
    assert get_upgrade_cost("그랜드 어센틱심볼 : 탈라하트", 10) == 3_718_000_000
    assert _total_cost("그랜드 어센틱심볼 : 기어드락", 11) == 20_181_300_000
    # 모르는 지역은 비용을 지어내지 않는다.
    assert get_upgrade_cost("어센틱심볼 : 새지역", 1) is None


# --- 심볼업 감지 -------------------------------------------------------------


def test_symbol_growth_fires_when_one_more_daily_quest_reaches_requirement() -> None:
    # 332 + 40 = 372 → 딱 요구치.
    detected = detect_symbol_growth(TEST_CHARACTER, [_symbol("아케인심볼 : 레헬른", 19, 332, 372)])
    assert len(detected) == 1
    assert detected[0].item_type == ITEM_TYPE_SYMBOL_GROWTH
    assert "일퀘 1회" in detected[0].message
    assert detected[0].ready_now is False
    # Lv19 → 20 레헬른 강화 비용.
    assert detected[0].meso_cost == 51_700_000


def test_symbol_growth_ignores_symbol_still_short_after_daily_quest() -> None:
    # 331 + 40 = 371 < 372.
    assert (
        detect_symbol_growth(TEST_CHARACTER, [_symbol("아케인심볼 : 레헬른", 19, 331, 372)]) == []
    )


def test_symbol_growth_flags_already_over_requirement_separately() -> None:
    detected = detect_symbol_growth(TEST_CHARACTER, [_symbol("어센틱심볼 : 오디움", 9, 1429, 909)])
    assert len(detected) == 1
    assert "이미" in detected[0].message
    assert detected[0].ready_now is True
    # 남는 520은 Lv10 요구치(1100)에 못 미쳐서 한 레벨만.
    assert detected[0].meso_cost == 1_036_200_000


def test_symbol_growth_counts_every_level_the_surplus_covers() -> None:
    # Lv1 요구 12, Lv2 요구 15 → 30이면 Lv3까지 두 번 올릴 수 있다.
    detected = detect_symbol_growth(
        TEST_CHARACTER, [_symbol("아케인심볼 : 소멸의 여로", 1, 30, 12)]
    )
    assert "Lv.3까지" in detected[0].message
    assert detected[0].meso_cost == 970_000 + 1_230_000


#: "아르고 호의 가호" 넥슨 응답 그대로(2026-10-06, 다섯별).
ARGO_EFFECT = (
    "보스 몬스터 공격 시 데미지 40% 증가\r\n"
    "몬스터 방어율 무시 20% 증가\r\n"
    "몬스터파크 퇴장 시 획득하는 경험치 50% 증가\r\n"
    "그란디스 일일퀘스트 완료 시 획득 경험치 10%, 획득 심볼 3개 증가\r\n"
    "[메이플 유니온] 주간 드래곤 퇴치 퀘스트 완료 시 유니온 코인 100개 추가 획득"
)


def _skill(name: str, effect: str | None) -> SkillInfo:
    return SkillInfo(skill_name=name, skill_level=1, skill_effect=effect)


def test_daily_bonus_parsed_from_event_skill_effect() -> None:
    bonuses = parse_daily_symbol_bonuses(
        [
            _skill("링크 매니지먼트", "자신의 링크 스킬 전수 상태를 관리"),
            _skill("아르고 호의 가호", ARGO_EFFECT),
        ]
    )
    assert bonuses == [DailySymbolBonus(skill_name="아르고 호의 가호", amount=3, area="그란디스")]
    # "그란디스"라서 어센틱 계열에만 붙는다.
    assert get_daily_bonus("어센틱심볼 : 세르니움", bonuses) == 3
    assert get_daily_bonus("그랜드 어센틱심볼 : 탈라하트", bonuses) == 3
    assert get_daily_bonus("아케인심볼 : 레헬른", bonuses) == 0


def test_daily_bonus_scope_follows_area_word() -> None:
    """이름이 바뀐 다음 이벤트 스킬도 문구 형식만 맞으면 읽는다."""
    bonuses = parse_daily_symbol_bonuses(
        [
            # 진격캐넌의 "아르고 호의 가호"에 실제로 있던 줄(2026-10-06).
            _skill(
                "다음 이벤트의 축복",
                "아케인리버 일일퀘스트 완료 시 획득 경험치 30%, 획득 심볼 2개 증가",
            ),
            _skill("또 다른 이벤트", "일일퀘스트 완료 시 획득 심볼 1개 증가"),
            _skill("효과 없음", None),
        ]
    )
    assert [(b.amount, b.area) for b in bonuses] == [(2, "아케인리버"), (1, None)]
    # 지역 없는 것은 모든 심볼에 붙고, 겹치면 더한다.
    assert get_daily_bonus("아케인심볼 : 레헬른", bonuses) == 3
    assert get_daily_bonus("어센틱심볼 : 오디움", bonuses) == 1


def test_symbol_growth_adds_event_bonus_to_daily_gain() -> None:
    bonuses = parse_daily_symbol_bonuses([_skill("아르고 호의 가호", ARGO_EFFECT)])
    # 오디움 Lv9 요구 909: 891 + 15 = 906이라 모자라지만, 이벤트 +3이면 딱 909.
    symbols = [_symbol("어센틱심볼 : 오디움", 9, 891, 909)]
    assert detect_symbol_growth(TEST_CHARACTER, symbols) == []
    detected = detect_symbol_growth(TEST_CHARACTER, symbols, bonuses)
    assert len(detected) == 1
    assert "일퀘 1회(+18, 이벤트 +3 포함)" in detected[0].message


def test_symbol_growth_skips_unknown_symbol_family() -> None:
    assert detect_symbol_growth(TEST_CHARACTER, [_symbol("정체불명 심볼", 1, 999, 1)]) == []


def test_symbol_growth_dedupe_key_changes_with_level() -> None:
    """레벨이 오르면 새 사건이라 발송 횟수가 새로 시작돼야 한다."""
    before = detect_symbol_growth(TEST_CHARACTER, [_symbol("아케인심볼 : 레헬른", 18, 330, 335)])
    after = detect_symbol_growth(TEST_CHARACTER, [_symbol("아케인심볼 : 레헬른", 19, 360, 372)])
    assert before[0].dedupe_key != after[0].dedupe_key


# --- 아티팩트 만료 감지 ------------------------------------------------------


def test_artifact_expiry_fires_inside_warning_window() -> None:
    now = datetime(2026, 9, 23, 12, 0, tzinfo=KST)
    detected = detect_artifact_expiry(
        TEST_CHARACTER, [_crystal("2026-09-27T20:35+09:00")], now, warning_days=7
    )
    assert len(detected) == 1
    assert detected[0].item_type == ITEM_TYPE_ARTIFACT_EXPIRY


def test_artifact_expiry_quiet_outside_warning_window() -> None:
    now = datetime(2026, 9, 23, 12, 0, tzinfo=KST)
    assert (
        detect_artifact_expiry(TEST_CHARACTER, [_crystal("2026-10-19T20:35+09:00")], now, 7) == []
    )


def test_artifact_expiry_uses_earliest_crystal_and_reports_expired() -> None:
    now = datetime(2026, 9, 23, 12, 0, tzinfo=KST)
    detected = detect_artifact_expiry(
        TEST_CHARACTER,
        [_crystal("2026-10-19T20:35+09:00"), _crystal("2026-09-22T09:00+09:00")],
        now,
        7,
    )
    assert len(detected) == 1
    assert detected[0].dedupe_key == "2026-09-22T09:00+09:00"
    assert "이미 만료" in detected[0].message


def test_artifact_expiry_ignores_missing_dates() -> None:
    now = datetime(2026, 9, 23, 12, 0, tzinfo=KST)
    assert detect_artifact_expiry(TEST_CHARACTER, [_crystal(None)], now, 7) == []


# --- 발송 포맷 ---------------------------------------------------------------


def test_discord_content_includes_every_notification() -> None:
    content = format_discord_content(
        [
            DetectedNotification(ITEM_TYPE_SYMBOL_GROWTH, TEST_CHARACTER, "k1", "제목1", "본문1"),
            DetectedNotification(ITEM_TYPE_ARTIFACT_EXPIRY, TEST_CHARACTER, "k2", "제목2", "본문2"),
        ]
    )
    assert "제목1" in content and "본문2" in content
    # 비용이 없는 블록에는 합계 줄이 붙지 않는다.
    assert "강화 비용" not in content


def test_discord_content_sums_pending_symbol_costs_per_character() -> None:
    content = format_discord_content(
        [
            DetectedNotification(
                ITEM_TYPE_SYMBOL_GROWTH, TEST_CHARACTER, "k1", "제목", "a", 1_036_200_000, True
            ),
            DetectedNotification(
                ITEM_TYPE_SYMBOL_GROWTH, TEST_CHARACTER, "k2", "제목", "b", 51_700_000, False
            ),
        ]
    )
    assert "밀린 강화 비용 10억 3,620만 메소 (일퀘 후 포함 10억 8,790만)" in content


# --- 채널 / 대상 등록 --------------------------------------------------------


async def _cleanup(session: AsyncSession) -> None:
    """테스트 채널만 지운다 — 대상과 발송 기록은 CASCADE로 같이 지워진다."""
    await session.execute(
        delete(NotificationChannel).where(
            NotificationChannel.webhook_url.in_([TEST_WEBHOOK, OTHER_WEBHOOK])
        )
    )
    await session.commit()


def test_mask_webhook_url_hides_token() -> None:
    masked = mask_webhook_url(TEST_WEBHOOK)
    assert "test-automation-webhook" not in masked
    assert masked.startswith("https://discord.com/api/webhooks/1/")


@pytest.mark.anyio
async def test_register_channel_only_accepts_discord_and_is_idempotent(
    db_session: AsyncSession,
) -> None:
    await _cleanup(db_session)
    try:
        with pytest.raises(NotificationInvalidInput):
            await register_channel(db_session, "https://example.com/api/webhooks/1/x")
        first = await register_channel(db_session, TEST_WEBHOOK)
        await db_session.commit()
        again = await register_channel(db_session, f"  {TEST_WEBHOOK} ")
        assert first.id == again.id and first.access_key == again.access_key
    finally:
        await _cleanup(db_session)


@pytest.mark.anyio
async def test_add_target_is_idempotent_and_scoped_to_channel(db_session: AsyncSession) -> None:
    await _cleanup(db_session)
    try:
        channel = await register_channel(db_session, TEST_WEBHOOK)
        other_channel = await register_channel(db_session, OTHER_WEBHOOK)
        first = await add_target(db_session, channel, ITEM_TYPE_SYMBOL_GROWTH, TEST_CHARACTER)
        await db_session.commit()
        again = await add_target(db_session, channel, ITEM_TYPE_SYMBOL_GROWTH, TEST_CHARACTER)
        await db_session.commit()
        assert first.id == again.id

        # 같은 캐릭터라도 항목이 다르면 따로 등록된다.
        other = await add_target(db_session, channel, ITEM_TYPE_ARTIFACT_EXPIRY, TEST_CHARACTER)
        # 다른 사람이 같은 캐릭터를 등록해도 따로다.
        theirs = await add_target(
            db_session, other_channel, ITEM_TYPE_SYMBOL_GROWTH, TEST_CHARACTER
        )
        await db_session.commit()
        assert len({first.id, other.id, theirs.id}) == 3

        assert len(await list_targets(db_session, channel)) == 2
        assert len(await list_targets(db_session, other_channel)) == 1

        with pytest.raises(NotificationInvalidInput):
            await add_target(db_session, channel, "unknown", TEST_CHARACTER)

        # 남의 대상은 지울 수 없다.
        with pytest.raises(NotificationNotFound):
            await remove_target(db_session, other_channel, first.id)
        await remove_target(db_session, channel, first.id)
        await db_session.commit()
        with pytest.raises(NotificationNotFound):
            await remove_target(db_session, channel, first.id)
    finally:
        await _cleanup(db_session)


@pytest.mark.anyio
async def test_targets_api_requires_channel_key(api_client: AsyncClient) -> None:
    response = await api_client.get("/api/v1/notifications/targets")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOTIFICATION_UNAUTHORIZED"

    response = await api_client.get(
        "/api/v1/notifications/targets", headers={"X-Notification-Key": "nope"}
    )
    assert response.status_code == 401


@pytest.mark.anyio
async def test_channel_api_round_trip(api_client: AsyncClient, db_session: AsyncSession) -> None:
    await _cleanup(db_session)
    try:
        response = await api_client.post(
            "/api/v1/notifications/channels", json={"webhook_url": TEST_WEBHOOK}
        )
        assert response.status_code == 201
        key = response.json()["access_key"]
        headers = {"X-Notification-Key": key}

        response = await api_client.post(
            "/api/v1/notifications/targets",
            json={"item_type": ITEM_TYPE_SYMBOL_GROWTH, "character_name": TEST_CHARACTER},
            headers=headers,
        )
        assert response.status_code == 201

        response = await api_client.get("/api/v1/notifications/targets", headers=headers)
        assert [t["character_name"] for t in response.json()["targets"]] == [TEST_CHARACTER]

        response = await api_client.delete("/api/v1/notifications/channels/me", headers=headers)
        assert response.status_code == 204
        response = await api_client.get("/api/v1/notifications/channels/me", headers=headers)
        assert response.status_code == 401
    finally:
        await _cleanup(db_session)


# --- 발송 횟수 상한 ----------------------------------------------------------


class _RecordingNotifier:
    """보낸 것처럼 성공을 돌려주는 가짜 채널."""

    def __init__(self) -> None:
        self.batches: list[list[DetectedNotification]] = []

    async def send(self, notifications: list[DetectedNotification]) -> bool:
        self.batches.append(list(notifications))
        return True


def _symbol_response(*symbols: tuple[str, int, int, int]) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "character_class": "메카닉",
            "symbol": [
                {
                    "symbol_name": name,
                    "symbol_level": level,
                    "symbol_growth_count": growth,
                    "symbol_require_growth_count": require,
                }
                for name, level, growth, require in symbols
            ],
        },
    )


def _skill_response(*effects: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "character_class": "메카닉",
            "character_skill_grade": "0",
            "character_skill": [
                {"skill_name": f"이벤트 스킬 {i}", "skill_level": 1, "skill_effect": effect}
                for i, effect in enumerate(effects)
            ],
        },
    )


@pytest.mark.anyio
async def test_same_notification_stops_after_max_send_count(
    db_session: AsyncSession, nexon_mock: MockRouter
) -> None:
    """같은 조건이 며칠 이어져도 상한(기본 3회)까지만 보낸다."""
    from app.core.config import settings
    from app.services.nexon.client import NexonApiClient
    from app.services.notification.service import run_check

    await _cleanup(db_session)
    nexon_mock.get("/maplestory/v1/id").mock(
        return_value=httpx.Response(200, json={"ocid": "ocid-1"})
    )
    route = nexon_mock.get("/maplestory/v1/character/symbol-equipment").mock(
        return_value=_symbol_response(("아케인심볼 : 레헬른", 19, 360, 372))
    )
    nexon_mock.get("/maplestory/v1/character/skill").mock(return_value=_skill_response())

    try:
        channel = await register_channel(db_session, TEST_WEBHOOK)
        await add_target(db_session, channel, ITEM_TYPE_SYMBOL_GROWTH, TEST_CHARACTER)
        await db_session.commit()

        notifier = _RecordingNotifier()
        async with NexonApiClient(api_key="test-key") as client:
            results = [
                await run_check(db_session, client, channel, notifier, send=True)
                for _ in range(settings.notification_max_send_count + 1)
            ]

        # 날짜 없이 불러서 가장 최근 스냅샷을 본다.
        assert "date" not in route.calls.last.request.url.params

        # 상한까지는 매번 나가고,
        assert all(len(r.sent) == 1 for r in results[: settings.notification_max_send_count])
        # 그 다음부터는 발송 대신 suppressed로 빠진다.
        assert results[-1].sent == []
        assert len(results[-1].suppressed) == 1
    finally:
        await _cleanup(db_session)


@pytest.mark.anyio
async def test_all_characters_go_out_in_one_message(
    db_session: AsyncSession, nexon_mock: MockRouter
) -> None:
    """캐릭터가 여럿이어도 한 메시지로 묶어서 한 번만 보낸다."""
    from app.services.nexon.client import NexonApiClient
    from app.services.notification.service import run_check

    other_character = f"{TEST_CHARACTER}2"
    await _cleanup(db_session)
    nexon_mock.get("/maplestory/v1/id").mock(
        return_value=httpx.Response(200, json={"ocid": "ocid-1"})
    )
    # 한 캐릭터에서 두 건이 나오는 상황.
    nexon_mock.get("/maplestory/v1/character/symbol-equipment").mock(
        return_value=_symbol_response(
            ("아케인심볼 : 레헬른", 19, 360, 372), ("아케인심볼 : 모라스", 19, 400, 372)
        )
    )
    nexon_mock.get("/maplestory/v1/character/skill").mock(return_value=_skill_response())

    try:
        channel = await register_channel(db_session, TEST_WEBHOOK)
        await add_target(db_session, channel, ITEM_TYPE_SYMBOL_GROWTH, TEST_CHARACTER)
        await add_target(db_session, channel, ITEM_TYPE_SYMBOL_GROWTH, other_character)
        await db_session.commit()

        notifier = _RecordingNotifier()
        async with NexonApiClient(api_key="test-key") as client:
            await run_check(db_session, client, channel, notifier, send=True)

        # 캐릭터가 몇 명이든 메시지는 한 번.
        assert len(notifier.batches) == 1
        batch = notifier.batches[0]
        # 두 캐릭터의 2건씩이 한 메시지에 다 들어간다.
        assert len(batch) == 4
        assert {n.character_name for n in batch} == {TEST_CHARACTER, other_character}
    finally:
        await _cleanup(db_session)


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("skill_response", "expected_count"),
    [
        # 0차 스킬의 이벤트 추가분(+3)이 있어야 891 + 15 + 3 = 909에 닿는다.
        (_skill_response(ARGO_EFFECT), 1),
        # 스킬 조회가 실패하면 기본 성장치로만 계산하고 검사는 계속한다.
        (httpx.Response(500, json={"error": {"name": "OPENAPI00001", "message": "x"}}), 0),
    ],
)
async def test_check_reads_event_bonus_from_beginner_skills(
    db_session: AsyncSession,
    nexon_mock: MockRouter,
    skill_response: httpx.Response,
    expected_count: int,
) -> None:
    from app.services.nexon.client import NexonApiClient
    from app.services.notification.service import run_check

    await _cleanup(db_session)
    nexon_mock.get("/maplestory/v1/id").mock(
        return_value=httpx.Response(200, json={"ocid": "ocid-1"})
    )
    nexon_mock.get("/maplestory/v1/character/symbol-equipment").mock(
        return_value=_symbol_response(("어센틱심볼 : 오디움", 9, 891, 909))
    )
    skill_route = nexon_mock.get("/maplestory/v1/character/skill").mock(return_value=skill_response)

    try:
        channel = await register_channel(db_session, TEST_WEBHOOK)
        await add_target(db_session, channel, ITEM_TYPE_SYMBOL_GROWTH, TEST_CHARACTER)
        await db_session.commit()

        async with NexonApiClient(api_key="test-key") as client:
            result = await run_check(db_session, client, channel, _RecordingNotifier(), send=False)

        assert skill_route.calls.last.request.url.params["character_skill_grade"] == "0"
        assert len(result.detected) == expected_count
        assert result.failures == {}
    finally:
        await _cleanup(db_session)
