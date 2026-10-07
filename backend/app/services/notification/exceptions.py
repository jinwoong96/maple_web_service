"""알림 도메인 예외.

라우터에서 `HTTPException`을 직접 던지지 않고 여기서 정의한 예외를 올린 뒤,
`api/errors.py`가 한곳에서 HTTP 응답으로 옮긴다(CLAUDE.md의 에러 규칙).
"""


class NotificationError(Exception):
    """알림 기능의 기본 예외."""

    status_code = 400
    code = "NOTIFICATION_ERROR"


class NotificationInvalidInput(NotificationError):
    status_code = 422
    code = "NOTIFICATION_INVALID_INPUT"


class NotificationUnauthorized(NotificationError):
    """채널 키가 없거나 등록되지 않은 키다."""

    status_code = 401
    code = "NOTIFICATION_UNAUTHORIZED"


class NotificationNotFound(NotificationError):
    status_code = 404
    code = "NOTIFICATION_NOT_FOUND"
