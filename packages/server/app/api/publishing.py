"""Publishing REST API endpoints.

Routes are mounted at /api/v1/publish (see main.py).

Visibility rules enforced here and in PublishingService:
  private  → only the author can read/write
  team     → any authenticated user can read
  public   → anyone can read (no auth required)
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.security import get_current_user
from ..db.models import User
from ..db.session import get_db
from ..models.publishing import (
    PublishRequest,
    PublishResponse,
    PublishedScript,
    Visibility,
)
from ..services.publishing import PublishingService

router = APIRouter()

# A permissive OAuth2 scheme that returns None (instead of raising 401)
# when no token is present — used by endpoints accessible without auth.
_optional_oauth2 = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)


# ---------------------------------------------------------------------------
# Singleton service (initialised from settings at import time)
# ---------------------------------------------------------------------------

_publishing_service: Optional[PublishingService] = None


def _get_service() -> PublishingService:
    global _publishing_service
    if _publishing_service is None:
        _publishing_service = PublishingService(data_dir=settings.PYIDE_DATA_DIR)
    return _publishing_service


def _build_share_url(pub_id: str) -> str:
    """Return the canonical share URL for a publication."""
    base = getattr(settings, "SERVER_URL", "http://localhost:8000").rstrip("/")
    return f"{base}/api/v1/publish/{pub_id}"


# ---------------------------------------------------------------------------
# Optional-auth helper
# ---------------------------------------------------------------------------

async def _optional_user(
    token: Optional[str] = Depends(_optional_oauth2),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Return the authenticated user if a valid token is provided, else None.

    Unlike get_current_user, this does NOT raise on missing/invalid tokens so
    that public endpoints can be accessed without credentials.
    """
    if not token:
        return None
    try:
        from ..core.security import _decode_token
        username = _decode_token(token)
        user = db.query(User).filter(User.username == username).first()
        return user
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/",
    response_model=PublishResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Publish a new script",
)
async def create_publication(
    request: PublishRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PublishResponse:
    """Create a brand-new published script (version 1).

    Requires authentication. The calling user becomes the author.
    """
    svc = _get_service()
    try:
        meta = await svc.create(
            user_id=current_user.id,
            username=current_user.username,
            request=request,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to publish: {exc}",
        ) from exc

    return PublishResponse(
        id=meta["id"],
        title=meta["title"],
        description=meta.get("description"),
        author=meta["author"],
        visibility=Visibility(meta["visibility"]),
        version=meta["version"],
        created_at=meta["created_at"],
        share_url=_build_share_url(meta["id"]),
    )


@router.get(
    "/browse/public",
    summary="Browse all public publications (no auth required)",
)
async def browse_public():
    """Return all publications with visibility 'public' or 'team'.

    This endpoint does **not** require authentication so that anonymous users
    can discover published work.
    """
    items = await _get_service().list_public()
    # Attach share URL to each item for convenience
    for item in items:
        item["share_url"] = _build_share_url(item["id"])
    return items


@router.get(
    "/",
    summary="List the current user's publications",
)
async def list_publications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all publications authored by the authenticated user."""
    items = await _get_service().list_by_user(user_id=current_user.id)
    for item in items:
        item["share_url"] = _build_share_url(item["id"])
    return items


@router.get(
    "/{pub_id}",
    response_model=PublishedScript,
    summary="Get a published script by ID",
)
async def get_publication(
    pub_id: str,
    version: Optional[int] = Query(default=None, description="Specific version number; omit for latest"),
    current_user: Optional[User] = Depends(_optional_user),
    db: Session = Depends(get_db),
) -> PublishedScript:
    """Fetch a publication.

    - **private** → must be the author.
    - **team** → must be authenticated.
    - **public** → anyone can read.
    """
    svc = _get_service()
    try:
        data = await svc.get(
            pub_id=pub_id,
            version=version,
            requesting_user_id=current_user.id if current_user else None,
            is_authenticated=current_user is not None,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve publication: {exc}",
        )

    return PublishedScript(
        id=data["id"],
        title=data["title"],
        description=data.get("description"),
        author=data["author"],
        source_code=data["source_code"],
        outputs=data.get("outputs"),
        visibility=Visibility(data["visibility"]),
        version=data["version"],
        versions=data.get("versions", []),
        tags=data.get("tags", []),
        environment=data.get("environment"),
        created_at=data["created_at"],
        updated_at=data["updated_at"],
    )


@router.put(
    "/{pub_id}",
    response_model=PublishResponse,
    summary="Publish a new version of an existing script",
)
async def update_publication(
    pub_id: str,
    request: PublishRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PublishResponse:
    """Add a new version snapshot to an existing publication.

    Only the original author may publish new versions.
    """
    svc = _get_service()
    try:
        meta = await svc.add_version(
            pub_id=pub_id,
            user_id=current_user.id,
            username=current_user.username,
            request=request,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to publish new version: {exc}",
        )

    return PublishResponse(
        id=meta["id"],
        title=meta["title"],
        description=meta.get("description"),
        author=meta["author"],
        visibility=Visibility(meta["visibility"]),
        version=meta["version"],
        created_at=meta["created_at"],
        share_url=_build_share_url(meta["id"]),
    )


@router.delete(
    "/{pub_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a publication",
)
async def delete_publication(
    pub_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all versions of a publication.

    Only the author or an admin may delete a publication.
    Currently all authenticated users are treated as non-admin unless the
    User model gains an `is_admin` field.
    """
    is_admin = getattr(current_user, "is_admin", False)
    svc = _get_service()
    try:
        await svc.delete(pub_id=pub_id, user_id=current_user.id, is_admin=is_admin)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete publication: {exc}",
        )
