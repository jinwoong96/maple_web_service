"""add job to guild_content_score

화면에서 읽은 직업을 같이 쌓는다. 거르고 보는 데만 쓰고 식별에는 쓰지 않는다
— 전직하면 바뀌기 때문이다. 못 읽은 줄은 비어 있다.

Revision ID: e851573b00ff
Revises: 2f07a1c4b9de
Create Date: 2026-09-27 11:39:14.141010

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e851573b00ff"
down_revision: str | Sequence[str] | None = "2f07a1c4b9de"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("guild_content_score", sa.Column("job", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("guild_content_score", "job")
