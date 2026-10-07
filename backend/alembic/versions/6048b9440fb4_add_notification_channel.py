"""add notification channel

알림 웹훅을 서버 설정 하나에서 사람마다 등록하는 방식으로 바꾼다.

이미 등록된 대상이 있고 `.env`에 `DISCORD_WEBHOOK_URL`이 남아 있으면, 그
URL로 채널을 하나 만들어 기존 대상을 옮긴다 — 같은 URL을 화면에서 다시
등록하면 그 대상들을 그대로 이어받는다. URL이 없으면 주인을 알 수 없는
대상이라 지운다. 발송 횟수 기록은 채널 기준으로 새로 센다(지워도 해가 없다).

Revision ID: 6048b9440fb4
Revises: 723471a061eb
Create Date: 2026-09-28 00:07:24.943550

"""

import os
import secrets
from collections.abc import Sequence

import sqlalchemy as sa
from dotenv import dotenv_values

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6048b9440fb4"
down_revision: str | Sequence[str] | None = "723471a061eb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _legacy_webhook_url() -> str:
    # 설정 클래스에서는 이 값을 뺐으므로 `.env`를 직접 읽는다.
    return (
        os.environ.get("DISCORD_WEBHOOK_URL")
        or dotenv_values(".env").get("DISCORD_WEBHOOK_URL")
        or ""
    ).strip()


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "notification_channel",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("webhook_url", sa.String(), nullable=False),
        sa.Column("access_key", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("access_key"),
        sa.UniqueConstraint("webhook_url"),
    )

    op.add_column("notification_target", sa.Column("channel_id", sa.Integer(), nullable=True))
    op.add_column("notification_dispatch", sa.Column("channel_id", sa.Integer(), nullable=True))

    conn = op.get_bind()
    op.execute("DELETE FROM notification_dispatch")
    has_targets = conn.execute(sa.text("SELECT 1 FROM notification_target LIMIT 1")).first()
    webhook_url = _legacy_webhook_url()
    if has_targets and webhook_url:
        channel_id = conn.execute(
            sa.text(
                "INSERT INTO notification_channel (webhook_url, access_key) "
                "VALUES (:url, :key) RETURNING id"
            ),
            {"url": webhook_url, "key": secrets.token_urlsafe(24)},
        ).scalar_one()
        conn.execute(sa.text("UPDATE notification_target SET channel_id = :id"), {"id": channel_id})
    op.execute("DELETE FROM notification_target WHERE channel_id IS NULL")

    op.alter_column("notification_target", "channel_id", nullable=False)
    op.alter_column("notification_dispatch", "channel_id", nullable=False)

    op.drop_constraint("uq_notification_dispatch", "notification_dispatch", type_="unique")
    op.create_unique_constraint(
        "uq_notification_dispatch",
        "notification_dispatch",
        ["channel_id", "item_type", "character_name", "dedupe_key"],
    )
    op.create_foreign_key(
        "fk_notification_dispatch_channel",
        "notification_dispatch",
        "notification_channel",
        ["channel_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("uq_notification_target", "notification_target", type_="unique")
    op.create_unique_constraint(
        "uq_notification_target",
        "notification_target",
        ["channel_id", "item_type", "character_name"],
    )
    op.create_foreign_key(
        "fk_notification_target_channel",
        "notification_target",
        "notification_channel",
        ["channel_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Downgrade schema.

    채널이 여럿이면 옛 유니크(항목, 캐릭터)에 걸리므로 대상을 비우고 되돌린다.
    """
    op.execute("DELETE FROM notification_target")
    op.execute("DELETE FROM notification_dispatch")
    op.drop_constraint("fk_notification_target_channel", "notification_target", type_="foreignkey")
    op.drop_constraint("uq_notification_target", "notification_target", type_="unique")
    op.create_unique_constraint(
        "uq_notification_target", "notification_target", ["item_type", "character_name"]
    )
    op.drop_column("notification_target", "channel_id")
    op.drop_constraint(
        "fk_notification_dispatch_channel", "notification_dispatch", type_="foreignkey"
    )
    op.drop_constraint("uq_notification_dispatch", "notification_dispatch", type_="unique")
    op.create_unique_constraint(
        "uq_notification_dispatch",
        "notification_dispatch",
        ["item_type", "character_name", "dedupe_key"],
    )
    op.drop_column("notification_dispatch", "channel_id")
    op.drop_table("notification_channel")
