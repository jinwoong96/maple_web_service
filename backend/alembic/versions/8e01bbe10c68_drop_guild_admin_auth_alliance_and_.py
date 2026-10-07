"""drop guild admin auth, alliance and score tables

주간 점수가 프론트엔드 전용으로 바뀌면서 서버에 점수를 저장하지 않고,
운영진 인증과 서버 쪽 연합길드도 없앤다(연합은 브라우저 localStorage로
옮겨 간다). 그 기능들만 쓰던 표를 모두 지운다.

downgrade는 지우기 직전의 모양(이후 마이그레이션으로 붙고 뗀 열까지 반영)
그대로 표를 되살린다. 행은 되살리지 않는다.

Revision ID: 8e01bbe10c68
Revises: 6048b9440fb4
Create Date: 2026-10-04 15:23:51.211282

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8e01bbe10c68"
down_revision: str | Sequence[str] | None = "6048b9440fb4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # 점수·직위 (d8ac7348c26e, e851573b00ff)
    op.drop_index(op.f("ix_guild_rank_oguild_id"), table_name="guild_rank")
    op.drop_table("guild_rank")
    op.drop_index(op.f("ix_guild_content_score_week_start"), table_name="guild_content_score")
    op.drop_index(op.f("ix_guild_content_score_oguild_id"), table_name="guild_content_score")
    op.drop_table("guild_content_score")

    # 연합 (e552a9ea0947) — 자식 표가 부모를 FK로 가리키므로 자식부터 지운다.
    op.drop_index(op.f("ix_guild_alliance_member_alliance_id"), table_name="guild_alliance_member")
    op.drop_table("guild_alliance_member")
    op.drop_index(op.f("ix_guild_alliance_invite_code"), table_name="guild_alliance")
    op.drop_table("guild_alliance")

    # 운영진 인증 (341b543038b8, 959f6fce0466, e552a9ea0947, 2f07a1c4b9de)
    op.drop_index(op.f("ix_guild_operator_oguild_id"), table_name="guild_operator")
    op.drop_table("guild_operator")
    op.drop_table("guild_admin_state")
    op.drop_index(op.f("ix_guild_admin_session_token_hash"), table_name="guild_admin_session")
    op.drop_index(op.f("ix_guild_admin_session_oguild_id"), table_name="guild_admin_session")
    op.drop_table("guild_admin_session")


def downgrade() -> None:
    """Downgrade schema."""
    # 운영진 인증
    op.create_table(
        "guild_admin_session",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("oguild_id", sa.String(), nullable=False),
        sa.Column("character_name", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("identities", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_guild_admin_session_oguild_id"),
        "guild_admin_session",
        ["oguild_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_guild_admin_session_token_hash"),
        "guild_admin_session",
        ["token_hash"],
        unique=True,
    )
    op.create_table(
        "guild_admin_state",
        sa.Column("oguild_id", sa.String(), nullable=False),
        sa.Column("guild_name", sa.String(), nullable=False),
        sa.Column("world_name", sa.String(), nullable=False),
        sa.Column("last_known_master", sa.String(), nullable=False),
        sa.Column("permission_preset", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("oguild_id"),
    )
    op.create_table(
        "guild_operator",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("oguild_id", sa.String(), nullable=False),
        sa.Column("character_name", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("permissions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("oguild_id", "character_name", name="uq_guild_operator"),
    )
    op.create_index(
        op.f("ix_guild_operator_oguild_id"), "guild_operator", ["oguild_id"], unique=False
    )

    # 연합 — 부모 표부터 만든다.
    op.create_table(
        "guild_alliance",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("invite_code", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_guild_alliance_invite_code"), "guild_alliance", ["invite_code"], unique=True
    )
    op.create_table(
        "guild_alliance_member",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("alliance_id", sa.Integer(), nullable=False),
        sa.Column("oguild_id", sa.String(), nullable=False),
        sa.Column("guild_name", sa.String(), nullable=False),
        sa.Column("world_name", sa.String(), nullable=False),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["alliance_id"], ["guild_alliance.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("oguild_id", name="uq_guild_alliance_member_guild"),
    )
    op.create_index(
        op.f("ix_guild_alliance_member_alliance_id"),
        "guild_alliance_member",
        ["alliance_id"],
        unique=False,
    )

    # 점수·직위
    op.create_table(
        "guild_content_score",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("oguild_id", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("ocid", sa.String(), nullable=False),
        sa.Column("character_name", sa.String(), nullable=False),
        sa.Column("score", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("job", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "oguild_id", "content_type", "week_start", "ocid", name="uq_guild_content_score"
        ),
    )
    op.create_index(
        op.f("ix_guild_content_score_oguild_id"),
        "guild_content_score",
        ["oguild_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_guild_content_score_week_start"),
        "guild_content_score",
        ["week_start"],
        unique=False,
    )
    op.create_table(
        "guild_rank",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("oguild_id", sa.String(), nullable=False),
        sa.Column("rank_name", sa.String(), nullable=False),
        sa.Column("rank_order", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("oguild_id", "rank_name", name="uq_guild_rank"),
    )
    op.create_index(op.f("ix_guild_rank_oguild_id"), "guild_rank", ["oguild_id"], unique=False)
