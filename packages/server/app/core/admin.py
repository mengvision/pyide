"""Admin dependency – ensures the caller is an administrator."""

from fastapi import Depends, HTTPException, status

from .security import get_current_user
from ..db.models import User


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """FastAPI dependency that gates access to admin-only endpoints.

    Raises HTTP 403 if the authenticated user does not have is_admin=True.
    """
    if not getattr(user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
