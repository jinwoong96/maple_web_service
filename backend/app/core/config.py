from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/maple"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:5173"]

    nexon_api_key: str = ""
    nexon_api_base_url: str = "https://open.api.nexon.com"
    # 매개변수 없는 넥슨 응답(공지 목록 등)을 몇 초나 재사용할지.
    # 공지는 하루 몇 번 바뀌는 자료라 5분이어도 사람 눈에는 티가 안 나고,
    # 넥슨 호출은 방문자 수와 무관하게 엔드포인트당 5분에 한 번으로 묶인다.
    # 배포 없이 조절하라고 설정으로 뺀다.
    nexon_cache_ttl_seconds: int = 300

    # 같은 알림을 최대 몇 번까지 보낼지. 심볼업 가능 상태처럼 며칠씩
    # 이어지는 조건이 매일 같은 알림을 반복해서 보내지 않도록 막는다.
    notification_max_send_count: int = 3
    # 유니온 아티팩트 만료를 며칠 전부터 알릴지.
    artifact_expiry_warning_days: int = 7


settings = Settings()
