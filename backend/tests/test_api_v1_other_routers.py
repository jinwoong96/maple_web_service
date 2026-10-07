import httpx
from httpx import AsyncClient
from respx import MockRouter


async def test_get_union_endpoint(api_client: AsyncClient, nexon_mock: MockRouter) -> None:
    nexon_mock.get("/maplestory/v1/user/union").mock(
        return_value=httpx.Response(
            200,
            json={
                "date": "2023-12-21T00:00+09:00",
                "union_level": 8000,
                "union_grade": "그랜드 마스터 유니온",
                "union_artifact_level": 30,
                "union_artifact_exp": 100,
                "union_artifact_point": 500,
            },
        )
    )

    response = await api_client.get("/api/v1/unions/abcd1234")

    assert response.status_code == 200
    assert response.json()["union_level"] == 8000


async def test_get_oguild_id_endpoint(api_client: AsyncClient, nexon_mock: MockRouter) -> None:
    nexon_mock.get("/maplestory/v1/guild/id").mock(
        return_value=httpx.Response(200, json={"oguild_id": "guild123"})
    )

    response = await api_client.get(
        "/api/v1/guilds/oguild-id", params={"guild_name": "테스트길드", "world_name": "스카니아"}
    )

    assert response.status_code == 200
    assert response.json() == {"oguild_id": "guild123"}


async def test_get_battle_practice_replay_ids_endpoint(
    api_client: AsyncClient, nexon_mock: MockRouter
) -> None:
    nexon_mock.get("/maplestory/v1/battle-practice/replay-id").mock(
        return_value=httpx.Response(
            200,
            json={
                "replay_list": [
                    {"period_no": 1, "register_date": "2023-12-21T00:00+09:00", "replay_id": "r1"}
                ]
            },
        )
    )

    response = await api_client.get(
        "/api/v1/battle-practice/replay-ids", params={"ocid": "abcd1234"}
    )

    assert response.status_code == 200
    assert response.json()["replay_list"][0]["replay_id"] == "r1"


async def test_get_ranking_overall_requires_date(
    api_client: AsyncClient, nexon_mock: MockRouter
) -> None:
    response = await api_client.get("/api/v1/rankings/overall")

    assert response.status_code == 422


async def test_get_ranking_overall_endpoint(
    api_client: AsyncClient, nexon_mock: MockRouter
) -> None:
    route = nexon_mock.get("/maplestory/v1/ranking/overall").mock(
        return_value=httpx.Response(200, json={"ranking": []})
    )

    response = await api_client.get(
        "/api/v1/rankings/overall", params={"date": "2023-12-27", "class": "히어로"}
    )

    assert response.status_code == 200
    assert route.calls.last.request.url.params["class"] == "히어로"


async def test_get_notice_general_list_endpoint(
    api_client: AsyncClient, nexon_mock: MockRouter, clean_nexon_cache: None
) -> None:
    nexon_mock.get("/maplestory/v1/notice").mock(
        return_value=httpx.Response(
            200,
            json={
                "notice": [
                    {
                        "title": "공지",
                        "url": "https://example.com",
                        "notice_id": 1,
                        "date": "2023-12-21T00:00+09:00",
                    }
                ]
            },
        )
    )

    response = await api_client.get("/api/v1/notices/general")

    assert response.status_code == 200
    assert response.json()["notice"][0]["notice_id"] == 1


async def test_unknown_guild_returns_404(api_client: AsyncClient, nexon_mock: MockRouter) -> None:
    """없는 길드면 넥슨이 200에 `oguild_id: null`을 준다.

    그대로 흘려보내면 응답 스키마에서 터져 500이 나가고, 브라우저에는 CORS
    헤더가 없는 응답이 도착해 `Failed to fetch`로 보인다 — 원인을 짐작할 수
    없는 형태다. 404로 바꿔 내보낸다.
    """
    nexon_mock.get("/maplestory/v1/guild/id").mock(
        return_value=httpx.Response(200, json={"oguild_id": None})
    )
    response = await api_client.get(
        "/api/v1/guilds/oguild-id",
        params={"guild_name": "없는길드이름12345", "world_name": "스카니아"},
    )
    assert response.status_code == 404
