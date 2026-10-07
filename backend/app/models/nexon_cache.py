from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NexonResponseCache(Base):
    """넥슨 응답을 그대로 담아 둔다.

    **서비스 전체가 넥슨 키 하나를 같이 쓴다.** 그래서 넥슨 호출 수가 자료가
    바뀌는 빈도가 아니라 **우리 방문자 수**를 따라 늘어난다. 홈 화면은 누구나
    열자마자 공지 목록 네 개를 부르므로, 키 한도에 제일 먼저 닿을 자리가
    거기다.

    표를 엔드포인트마다 만들지 않고 하나로 둔 이유는, **매개변수가 없는**
    다른 엔드포인트가 생겨도 스키마를 안 고치고 열쇠만 늘리면 되기 때문이다.
    ocid·oguild_id·날짜로 갈리는 것들은 여기 대상이 아니다 — 그건 같은 대상을
    다시 볼 때만 아껴지는 것이라 성격이 다르다.
    """

    __tablename__ = "nexon_response_cache"

    #: 엔드포인트 하나에 열쇠 하나. 예: `notice:general`.
    cache_key: Mapped[str] = mapped_column(String, primary_key=True)
    #: 마지막으로 성공한 응답. 손대지 않고 그대로 담는다.
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
