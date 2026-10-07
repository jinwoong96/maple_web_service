"""add nexon_response_cache table

넥슨 응답을 잠시 담아 두는 표. 서비스 전체가 넥슨 키 하나를 같이 써서, 호출
수가 자료가 바뀌는 빈도가 아니라 방문자 수를 따라 늘어나는 것을 막는다.
엔드포인트마다 표를 만들지 않고 열쇠 하나로 가른다.

Revision ID: 723471a061eb
Revises: e851573b00ff
Create Date: 2026-09-27 12:38:26.929473

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "723471a061eb"
down_revision: str | Sequence[str] | None = "e851573b00ff"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "nexon_response_cache",
        sa.Column("cache_key", sa.String(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("cache_key"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("nexon_response_cache")
