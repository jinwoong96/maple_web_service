from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.services.nexon.exceptions import NexonApiError
from app.services.notification.exceptions import NotificationError


async def nexon_api_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, NexonApiError)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.error_name, "message": exc.error_message}},
    )


async def notification_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, NotificationError)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": str(exc)}},
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(NexonApiError, nexon_api_error_handler)
    app.add_exception_handler(NotificationError, notification_error_handler)
