"""Admin API routes – all endpoints require admin role."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from ..core.admin import require_admin
from ..core.config import settings
from ..core.kernel_manager import kernel_manager
from ..core.security import get_password_hash
from ..db.models import User
from ..db.session import get_db
from ..models.admin import (
    CreateUserRequest,
    ResetPasswordRequest,
    TeamSettings,
    UpdateUserRequest,
    UserResponse,
)
from ..services.audit import AuditService

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

_audit = AuditService(settings.PYIDE_DATA_DIR)

# Path for persisted team settings (simple JSON file)
_TEAM_SETTINGS_PATH = Path(settings.PYIDE_DATA_DIR) / "system" / "team_settings.json"


def _load_team_settings() -> dict:
    if _TEAM_SETTINGS_PATH.exists():
        try:
            return json.loads(_TEAM_SETTINGS_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
    # Defaults
    return TeamSettings().model_dump()


def _save_team_settings(data: dict) -> None:
    try:
        _TEAM_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        _TEAM_SETTINGS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except OSError as exc:
        logger.error("Failed to persist team settings: %s", exc)


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users with their roles and status."""
    users = db.query(User).order_by(User.id).all()
    return users


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest,
    req: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new user (admin only)."""
    existing = (
        db.query(User)
        .filter((User.username == request.username) | (User.email == request.email))
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists",
        )

    new_user = User(
        username=request.username,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        is_admin=request.is_admin,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    await _audit.log(
        user_id=str(admin.id),
        action="user.create",
        resource=f"user:{new_user.id}",
        details={"username": new_user.username, "is_admin": new_user.is_admin},
        ip_address=req.client.host if req.client else None,
    )
    return new_user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    request: UpdateUserRequest,
    req: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update user role, status, or resource limits."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    changes: dict = {}
    if request.email is not None:
        user.email = request.email
        changes["email"] = request.email
    if request.is_admin is not None:
        user.is_admin = request.is_admin
        changes["is_admin"] = request.is_admin
    if request.is_active is not None:
        user.is_active = request.is_active
        changes["is_active"] = request.is_active
    if request.cpu_limit is not None:
        user.cpu_limit = request.cpu_limit
        changes["cpu_limit"] = request.cpu_limit
    if request.memory_limit is not None:
        user.memory_limit = request.memory_limit
        changes["memory_limit"] = request.memory_limit

    db.commit()
    db.refresh(user)

    await _audit.log(
        user_id=str(admin.id),
        action="user.update",
        resource=f"user:{user_id}",
        details=changes,
        ip_address=req.client.host if req.client else None,
    )
    return user


@router.post("/users/{user_id}/disable", response_model=UserResponse)
async def disable_user(
    user_id: int,
    req: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Disable a user account (sets is_active=False)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable your own account",
        )

    user.is_active = False
    db.commit()
    db.refresh(user)

    await _audit.log(
        user_id=str(admin.id),
        action="user.disable",
        resource=f"user:{user_id}",
        ip_address=req.client.host if req.client else None,
    )
    return user


@router.post("/users/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    request: ResetPasswordRequest,
    req: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Reset a user's password (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.hashed_password = get_password_hash(request.new_password)
    db.commit()

    await _audit.log(
        user_id=str(admin.id),
        action="user.reset_password",
        resource=f"user:{user_id}",
        ip_address=req.client.host if req.client else None,
    )
    return {"detail": "Password reset successfully"}


# ---------------------------------------------------------------------------
# Resource monitoring
# ---------------------------------------------------------------------------


@router.get("/resources")
async def get_system_resources(admin: User = Depends(require_admin)):
    """Get system resource usage (CPU, RAM, disk)."""
    try:
        import psutil  # type: ignore

        disk = psutil.disk_usage("/")
        mem = psutil.virtual_memory()
        return {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory": {
                "total": mem.total,
                "used": mem.used,
                "available": mem.available,
                "percent": mem.percent,
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": disk.percent,
            },
        }
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="psutil is not installed – cannot retrieve resource metrics",
        )


@router.get("/resources/kernels")
async def get_kernel_resources(admin: User = Depends(require_admin)):
    """Get all active kernel processes and their per-process resource usage."""
    kernels = await kernel_manager.list_kernels()

    try:
        import psutil  # type: ignore

        for k in kernels:
            pid = None
            # kernel_manager stores subprocess.Popen; access internal _kernels to get pid
            kp = kernel_manager._kernels.get(k["user_id"])
            if kp is not None and kp.process is not None:
                pid = kp.process.pid
            if pid:
                try:
                    proc = psutil.Process(pid)
                    with proc.oneshot():
                        k["pid"] = pid
                        k["cpu_percent"] = proc.cpu_percent(interval=0)
                        mem_info = proc.memory_info()
                        k["memory_rss_mb"] = round(mem_info.rss / 1024 / 1024, 2)
                        k["status"] = proc.status()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    k["pid"] = pid
                    k["cpu_percent"] = None
                    k["memory_rss_mb"] = None
                    k["status"] = "unknown"
    except ImportError:
        pass  # Return kernels without resource data when psutil missing

    return kernels


# ---------------------------------------------------------------------------
# Team settings
# ---------------------------------------------------------------------------


@router.get("/settings")
async def get_team_settings(admin: User = Depends(require_admin)):
    """Get team-level settings."""
    return _load_team_settings()


@router.put("/settings")
async def update_team_settings(
    team_settings: TeamSettings,
    req: Request,
    admin: User = Depends(require_admin),
):
    """Update team settings (publishing toggle, permissions, etc.)."""
    data = team_settings.model_dump()
    _save_team_settings(data)

    await _audit.log(
        user_id=str(admin.id),
        action="settings.update",
        resource="team_settings",
        details=data,
        ip_address=req.client.host if req.client else None,
    )
    return data


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------


@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    action: Optional[str] = Query(default=None),
    admin: User = Depends(require_admin),
):
    """Get audit log entries (most-recent first)."""
    entries = await _audit.query(limit=limit, offset=offset, action=action)
    return {"total_returned": len(entries), "offset": offset, "entries": entries}
