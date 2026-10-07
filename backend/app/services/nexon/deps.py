from collections.abc import AsyncGenerator

from app.core.config import settings
from app.services.nexon.client import NexonApiClient


async def get_nexon_client() -> AsyncGenerator[NexonApiClient, None]:
    """FastAPI dependency yielding a client authenticated with the shared/common API key."""
    async with NexonApiClient(
        api_key=settings.nexon_api_key, base_url=settings.nexon_api_base_url
    ) as client:
        yield client
