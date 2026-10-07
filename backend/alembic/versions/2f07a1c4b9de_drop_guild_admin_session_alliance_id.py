"""drop guild_admin_session.alliance_id

Revision ID: 2f07a1c4b9de
Revises: e552a9ea0947
Create Date: 2026-09-27

연합 작업 초기에는 세션에 `alliance_id`를 적어 뒀다. 그러면 **인증한 뒤에**
연합에 들어간 경우 그 세션이 연합을 영영 못 보는 문제가 있어, 요청마다 다시
읽는 쪽으로 바꾸면서 모델에서 뺐다. 그런데 개발 DB에는 열이 남아 있어
`alembic revision --autogenerate`를 돌릴 때마다 지우라고 나왔다.

`IF EXISTS`로 지운다 — 그 열이 없는 DB도 있다(마이그레이션으로 만든 적이
없다).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "2f07a1c4b9de"
down_revision: str | Sequence[str] | None = "e552a9ea0947"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_guild_admin_session_alliance_id")
    op.execute("ALTER TABLE guild_admin_session DROP COLUMN IF EXISTS alliance_id")


def downgrade() -> None:
    """되돌리지 않는다. 아무도 읽지 않는 열을 되살릴 이유가 없다."""
