from pydantic import BaseModel, Field


class NotificationChannelCreate(BaseModel):
    webhook_url: str = Field(description="디스코드 웹훅 URL")


class NotificationChannelEntry(BaseModel):
    #: 이후 요청의 `X-Notification-Key` 헤더에 넣는 값.
    access_key: str
    #: 토큰 부분을 가린 웹훅 URL(확인용).
    webhook_url_masked: str


class NotificationTargetCreate(BaseModel):
    item_type: str = Field(description="symbol_growth | artifact_expiry")
    character_name: str


class NotificationTargetEntry(BaseModel):
    id: int
    item_type: str
    character_name: str


class NotificationTargetListResponse(BaseModel):
    targets: list[NotificationTargetEntry]


class NotificationEntry(BaseModel):
    item_type: str
    character_name: str
    title: str
    message: str
    #: 이 알림대로 강화하는 데 드는 메소(심볼업만). 모르면 null.
    meso_cost: int | None = None
    #: 일퀘 없이 지금 바로 심볼업이 가능한지.
    ready_now: bool = False


class NotificationCheckResponse(BaseModel):
    #: 조건을 만족한 알림 전부.
    detected: list[NotificationEntry]
    #: 발송 횟수 상한에 걸려 보내지 않은 것.
    suppressed: list[NotificationEntry]
    #: 실제로 발송한 것. `send=false`로 호출하면 항상 비어 있다.
    sent: list[NotificationEntry]
    #: 조회에 실패한 대상 ("캐릭터명(항목)" -> 사유).
    failures: dict[str, str]
