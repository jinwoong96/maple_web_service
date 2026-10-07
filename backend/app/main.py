from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_exception_handlers
from app.api.v1 import router as v1_router
from app.core.config import settings

app = FastAPI(title="maple_web_service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # 메서드를 하나하나 적다가 두 번 데였다 — 알림 등록 때 POST/DELETE가
    # 빠져서, 길드 관리 때 PATCH가 빠져서 브라우저 프리플라이트(OPTIONS)가
    # 400으로 막혔다. 새 메서드를 쓸 때마다 여기를 기억해야 하는 구조 자체가
    # 문제라 전체 허용으로 바꿨다. 자격 증명을 쿠키로 주고받지 않으므로
    # (토큰은 Authorization 헤더) `*`로 열어도 위험이 늘지 않는다.
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)
app.include_router(v1_router, prefix=settings.api_v1_prefix)
