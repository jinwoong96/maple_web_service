class NexonApiError(Exception):
    """Raised when the Nexon Open API returns an error response (400/403/500/...)."""

    def __init__(self, status_code: int, error_name: str, error_message: str) -> None:
        self.status_code = status_code
        self.error_name = error_name
        self.error_message = error_message
        super().__init__(f"[{status_code}] {error_name}: {error_message}")


class NexonRateLimitError(NexonApiError):
    """Raised on HTTP 429 — caller should back off before retrying."""
