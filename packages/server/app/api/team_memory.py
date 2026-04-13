"""
Team Memory API
===============
CRUD + search endpoints for shared team memories.

Endpoints:
  POST   /api/v1/team-memory/           – create
  GET    /api/v1/team-memory/           – list (with optional filters)
  GET    /api/v1/team-memory/search/    – keyword search
  GET    /api/v1/team-memory/{id}       – get one
  PUT    /api/v1/team-memory/{id}       – update (author / admin)
  DELETE /api/v1/team-memory/{id}       – delete (author / admin)

Permission model:
  public      → all authenticated users
  department  → treated as public (future: department-scoped)
  sensitive   → admin-only (User.is_admin flag; falls back to False if absent)
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..core.config import settings
from ..core.security import get_current_user
from ..db.models import User
from ..models.memory import TeamMemoryCreate, TeamMemoryResponse, TeamMemoryUpdate
from ..services.team_memory import get_team_memory_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_admin(user: User) -> bool:
    """Return True when the user has admin privileges."""
    return bool(getattr(user, "is_admin", False))


def _get_service():
    return get_team_memory_service(settings.PYIDE_DATA_DIR)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/", response_model=TeamMemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory(
    request: TeamMemoryCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new team memory entry."""
    svc = _get_service()
    return await svc.create(
        user_id=current_user.id,
        username=current_user.username,
        request=request,
    )


@router.get("/", response_model=List[TeamMemoryResponse])
async def list_memories(
    permission: Optional[str] = Query(default=None, description="Filter by permission level"),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    current_user: User = Depends(get_current_user),
):
    """List team memories accessible to the current user."""
    svc = _get_service()
    return await svc.list_all(
        permission_filter=permission,
        category_filter=category,
        is_admin=_is_admin(current_user),
    )


@router.get("/search/", response_model=List[TeamMemoryResponse])
async def search_memories(
    q: str = Query(..., description="Search keyword"),
    current_user: User = Depends(get_current_user),
):
    """Search team memories by keyword (content, category, tags)."""
    if not q.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Search query must not be empty",
        )
    svc = _get_service()
    return await svc.search(query=q, is_admin=_is_admin(current_user))


@router.get("/{memory_id}", response_model=TeamMemoryResponse)
async def get_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a specific team memory entry."""
    svc = _get_service()
    memory = await svc.get(memory_id)

    # Sensitive memories are admin-only
    if memory["permission"] == "sensitive" and not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to sensitive memories requires admin privileges",
        )

    return memory


@router.put("/{memory_id}", response_model=TeamMemoryResponse)
async def update_memory(
    memory_id: str,
    request: TeamMemoryUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update a team memory (author or admin only)."""
    svc = _get_service()
    return await svc.update(
        memory_id=memory_id,
        user_id=current_user.id,
        username=current_user.username,
        request=request,
        is_admin=_is_admin(current_user),
    )


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a team memory (author or admin only)."""
    svc = _get_service()
    await svc.delete(
        memory_id=memory_id,
        user_id=current_user.id,
        is_admin=_is_admin(current_user),
    )
