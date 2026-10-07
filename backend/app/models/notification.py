from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationChannel(Base):
    """알림을 받는 사람 한 명 = 디스코드 웹훅 하나.

    로그인이 없는 서비스라 "사람"을 웹훅 URL로 가른다. 등록하면
    `access_key`(무작위 토큰)를 돌려주고, 브라우저는 그 키로 자기 대상만
    보고 고친다. 같은 URL을 다시 등록하면 같은 키가 나온다 — 웹훅 URL을
    가진 사람이 곧 주인이라는 뜻이라, 다른 기기에서도 URL만 넣으면 이어서
    쓸 수 있다.
    """

    __tablename__ = "notification_channel"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    webhook_url: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    access_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NotificationTarget(Base):
    """알림 항목별로 감시할 캐릭터. 채널(사람)마다 따로 가진다.

    항목(`item_type`)마다 따로 등록한다 — 심볼업만 받고 싶은 캐릭터와
    아티팩트 만료만 받고 싶은 캐릭터가 다를 수 있기 때문이다. `ocid`는
    닉네임으로 매번 다시 조회하지 않으려고 캐싱해두는 값이고, 조회에
    실패하면 다시 받아온다.
    """

    __tablename__ = "notification_target"
    __table_args__ = (
        UniqueConstraint(
            "channel_id", "item_type", "character_name", name="uq_notification_target"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    channel_id: Mapped[int] = mapped_column(
        ForeignKey("notification_channel.id", ondelete="CASCADE"), nullable=False
    )
    item_type: Mapped[str] = mapped_column(String, nullable=False)
    character_name: Mapped[str] = mapped_column(String, nullable=False)
    ocid: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NotificationDispatch(Base):
    """같은 알림을 몇 번 보냈는지 기록.

    "오늘 일퀘하면 심볼업" 같은 조건은 실제로 퀘스트를 할 때까지 며칠씩
    이어지기 때문에, 매일 검사하면 같은 내용이 계속 나간다. `dedupe_key`가
    같은 알림은 `notification_max_send_count`번까지만 보낸다.

    키에는 "이 알림이 같은 사건인지"를 가르는 값이 들어간다 — 심볼이면
    심볼 이름과 레벨(레벨이 오르면 새 사건), 아티팩트면 만료 일시(연장하면
    새 사건)다. 그래서 상황이 실제로 바뀌면 카운트가 자연히 새로 시작된다.
    """

    __tablename__ = "notification_dispatch"
    __table_args__ = (
        UniqueConstraint(
            "channel_id",
            "item_type",
            "character_name",
            "dedupe_key",
            name="uq_notification_dispatch",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    #: 같은 캐릭터를 두 사람이 등록해도 발송 횟수는 사람마다 따로 센다.
    channel_id: Mapped[int] = mapped_column(
        ForeignKey("notification_channel.id", ondelete="CASCADE"), nullable=False
    )
    item_type: Mapped[str] = mapped_column(String, nullable=False)
    character_name: Mapped[str] = mapped_column(String, nullable=False)
    dedupe_key: Mapped[str] = mapped_column(String, nullable=False)
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
