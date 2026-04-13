"""Kernel management REST API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..db.models import User
from ..core.security import get_current_user
from ..core.kernel_manager import kernel_manager

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class KernelStartRequest(BaseModel):
    """Request to start a kernel with optional environment template."""
    env_template_id: int | None = None


class KernelInfo(BaseModel):
    user_id: int
    username: str
    port: int
    ws_url: str
    alive: bool


class KernelStatusResponse(BaseModel):
    status: str       # "running" | "not_found"
    kernel: KernelInfo | None = None


class KernelListItem(BaseModel):
    user_id: int
    username: str
    port: int
    alive: bool
    workspace_dir: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/create",
    response_model=KernelInfo,
    summary="Create (or reuse) a kernel for the current user",
)
async def create_kernel(
    request: KernelStartRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a PyKernel subprocess for the authenticated user.

    If a kernel is already running for this user it is reused (idempotent).
    Returns the WebSocket URL the client should connect to via the proxy.
    
    Args:
        request: Optional request body with env_template_id for uv-managed environment.
    """
    env_template_id = request.env_template_id if request else None
    
    try:
        kp = await kernel_manager.get_or_create_kernel(
            user_id=current_user.id,
            username=current_user.username,
            env_template_id=env_template_id,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return KernelInfo(
        user_id=kp.user_id,
        username=kp.username,
        port=kp.port,
        ws_url="/ws/kernel",   # client connects through the server proxy
        alive=kp.is_alive,
    )


@router.delete(
    "/destroy",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Destroy the current user's kernel",
)
async def destroy_kernel(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Terminate the PyKernel subprocess for the authenticated user."""
    await kernel_manager.destroy_kernel(user_id=current_user.id)


@router.get(
    "/status",
    response_model=KernelStatusResponse,
    summary="Get kernel status for the current user",
)
async def kernel_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the running/not_found status of the user's kernel."""
    kp = await kernel_manager.get_kernel(user_id=current_user.id)
    if kp is None:
        return KernelStatusResponse(status="not_found")

    return KernelStatusResponse(
        status="running",
        kernel=KernelInfo(
            user_id=kp.user_id,
            username=kp.username,
            port=kp.port,
            ws_url="/ws/kernel",
            alive=kp.is_alive,
        ),
    )


@router.get(
    "/health",
    summary="Ping the user's kernel subprocess",
)
async def kernel_health(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return whether the kernel WebSocket is accepting connections."""
    alive = await kernel_manager.health_check(user_id=current_user.id)
    return {"alive": alive}


@router.get(
    "/list",
    response_model=list[KernelListItem],
    summary="List all running kernels (admin / debugging)",
)
async def list_kernels(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a list of all active kernel processes (any user).

    In production this should be restricted to admin users.
    """
    kernels = await kernel_manager.list_kernels()
    return kernels
