"""Dev-only playground for the Nexon Open API services.

Calls the `app.services.nexon.*` functions directly (no HTTP layer) so every
endpoint can be tried with simple form inputs. Run from `backend/`:

    uv run streamlit run tools/streamlit_app.py
"""

import asyncio
import inspect
import sys
from collections.abc import Callable, Coroutine
from pathlib import Path
from typing import Any

import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pydantic import BaseModel

from app.core.config import settings
from app.services.nexon import (
    battle_practice,
    character,
    guild,
    notice,
    probability,
    ranking,
    scheduler,
    union,
)
from app.services.nexon.client import NexonApiClient
from app.services.nexon.exceptions import NexonApiError

CATEGORIES: dict[str, Any] = {
    "Character (캐릭터)": character,
    "Union (유니온)": union,
    "Guild (길드)": guild,
    "BattlePractice (연무장)": battle_practice,
    "Probability (확률)": probability,
    "Scheduler (스케줄러)": scheduler,
    "Ranking (랭킹)": ranking,
    "Notice (공지)": notice,
}


def endpoint_functions(module: Any) -> dict[str, Callable[..., Coroutine[Any, Any, Any]]]:
    return {
        name: obj
        for name, obj in inspect.getmembers(module, inspect.iscoroutinefunction)
        if name.startswith("get_")
    }


def run_async(coro: Coroutine[Any, Any, Any]) -> Any:
    return asyncio.run(coro)


async def call_endpoint(
    api_key: str, func: Callable[..., Coroutine[Any, Any, Any]], kwargs: dict[str, Any]
) -> Any:
    async with NexonApiClient(api_key=api_key, base_url=settings.nexon_api_base_url) as client:
        return await func(client, **kwargs)


def input_key(param_name: str) -> str:
    """Widget key shared by param name across endpoints, so resolving an ocid/
    oguild_id/replay_id once (or typing a date) carries over everywhere."""
    return f"nexon_input__{param_name}"


def render_result(result: Any) -> None:
    if isinstance(result, BaseModel):
        st.json(result.model_dump(by_alias=True, mode="json"))
    elif isinstance(result, str):
        st.code(result)
    else:
        st.write(result)


st.set_page_config(page_title="Nexon Open API 콘솔", layout="wide")
st.title("Nexon Open API 테스트 콘솔")
st.caption("app.services.nexon.* 함수를 직접 호출하는 개발용 도구입니다 (HTTP 레이어 없음).")

with st.sidebar:
    st.header("설정")
    api_key = st.text_input("x-nxopen-api-key", value=settings.nexon_api_key, type="password")

    st.divider()
    st.subheader("빠른 조회 도우미")

    with st.expander("캐릭터 이름 → ocid"):
        character_name = st.text_input("character_name", key="helper_character_name")
        if st.button("조회", key="helper_ocid_btn") and character_name:
            try:
                ocid = run_async(
                    call_endpoint(api_key, character.get_ocid, {"character_name": character_name})
                )
                st.session_state[input_key("ocid")] = ocid
                st.success(ocid)
            except NexonApiError as e:
                st.error(f"[{e.status_code}] {e.error_name}: {e.error_message}")

    with st.expander("길드명 + 월드명 → oguild_id"):
        guild_name = st.text_input("guild_name", key="helper_guild_name")
        world_name = st.text_input("world_name", key="helper_world_name")
        if st.button("조회", key="helper_oguild_btn") and guild_name and world_name:
            try:
                oguild_id = run_async(
                    call_endpoint(
                        api_key,
                        guild.get_oguild_id,
                        {"guild_name": guild_name, "world_name": world_name},
                    )
                )
                st.session_state[input_key("oguild_id")] = oguild_id
                st.success(oguild_id)
            except NexonApiError as e:
                st.error(f"[{e.status_code}] {e.error_name}: {e.error_message}")

    with st.expander("ocid → 연무장 replay_id 목록"):
        ocid_for_replay = st.session_state.get(input_key("ocid"), "")
        st.caption(
            f"사용할 ocid: `{ocid_for_replay}`"
            if ocid_for_replay
            else "먼저 위에서 ocid를 조회하세요."
        )
        if st.button("조회", key="helper_replay_btn") and ocid_for_replay:
            try:
                replay = run_async(
                    call_endpoint(
                        api_key,
                        battle_practice.get_battle_practice_replay_id,
                        {"ocid": ocid_for_replay},
                    )
                )
                if replay.replay_list:
                    options = {
                        f"{r.register_date} (period {r.period_no})": r.replay_id
                        for r in replay.replay_list
                    }
                    picked = st.selectbox("replay 선택", list(options))
                    st.session_state[input_key("replay_id")] = options[picked]
                    st.success(options[picked])
                else:
                    st.info("리플레이 기록이 없습니다.")
            except NexonApiError as e:
                st.error(f"[{e.status_code}] {e.error_name}: {e.error_message}")

col1, col2 = st.columns(2)
with col1:
    category_label = st.selectbox("카테고리", list(CATEGORIES))
module = CATEGORIES[category_label]
funcs = endpoint_functions(module)

with col2:
    endpoint_label = st.selectbox("엔드포인트", sorted(funcs))
func = funcs[endpoint_label]

st.divider()
if func.__doc__:
    st.caption(func.__doc__.strip().splitlines()[0])

sig = inspect.signature(func)
params = list(sig.parameters.values())[1:]  # skip leading `client`

kwargs: dict[str, Any] = {}
missing_required: list[str] = []

if params:
    st.subheader("파라미터")
for param in params:
    required = param.default is inspect.Parameter.empty
    display_name = param.name.rstrip("_")  # class_ -> class
    label = f"{display_name} {'*' if required else '(선택)'}"
    raw = st.text_input(label, key=input_key(param.name))

    if not raw.strip():
        if required:
            missing_required.append(param.name)
        continue

    annotation = str(param.annotation)
    if "int" in annotation and "str" not in annotation:
        try:
            kwargs[param.name] = int(raw.strip())
        except ValueError:
            st.error(f"'{param.name}'은(는) 정수여야 합니다.")
            missing_required.append(param.name)
    else:
        kwargs[param.name] = raw.strip()

st.divider()
if st.button("호출", type="primary"):
    if missing_required:
        st.error(f"필수 파라미터 누락: {', '.join(missing_required)}")
    elif not api_key:
        st.error("API 키를 입력해주세요.")
    else:
        try:
            with st.spinner("호출 중..."):
                result = run_async(call_endpoint(api_key, func, kwargs))
            render_result(result)
        except NexonApiError as e:
            st.error(f"[{e.status_code}] {e.error_name}: {e.error_message}")
        except Exception as e:  # noqa: BLE001 - surface any unexpected error to the tester
            st.error(f"{type(e).__name__}: {e}")
