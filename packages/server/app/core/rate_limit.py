"""In-memory rate limiter for auth endpoints."""

from collections import defaultdict
from time import time

from fastapi import Depends, HTTPException, Request

from .config import settings


class RateLimiter:
    """Simple sliding-window in-memory rate limiter.

    Tracks request timestamps per client IP.  Not suitable for multi-process
    deployments (use Redis in that case), but works correctly for a single
    uvicorn worker.
    """

    def __init__(self, max_requests: int = 5, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def check(self, request: Request) -> None:
        """Raise HTTP 429 if the client has exceeded the rate limit."""
        client_ip: str = request.client.host if request.client else "unknown"
        now = time()

        # Evict timestamps outside the current window
        self._requests[client_ip] = [
            t for t in self._requests[client_ip] if now - t < self.window
        ]

        if len(self._requests[client_ip]) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later.",
            )

        self._requests[client_ip].append(now)


# ---------------------------------------------------------------------------
# Singleton instances
# ---------------------------------------------------------------------------

# Auth-specific limiter (tighter): 5 attempts per 60 s per IP
auth_rate_limiter = RateLimiter(
    max_requests=settings.RATE_LIMIT_MAX_REQUESTS,
    window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
)


# ---------------------------------------------------------------------------
# FastAPI dependency factories
# ---------------------------------------------------------------------------

def get_auth_rate_limiter() -> RateLimiter:
    """Return the shared auth rate-limiter instance."""
    return auth_rate_limiter


async def auth_rate_limit(
    request: Request,
    limiter: RateLimiter = Depends(get_auth_rate_limiter),
) -> None:
    """FastAPI dependency: enforce auth rate limiting."""
    await limiter.check(request)
