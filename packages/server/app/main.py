import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import Response

from .core.config import settings
from .core.kernel_manager import kernel_manager
from .api import auth, kernels, publishing, team_memory, admin, environments
from .api import mcp as mcp_api
from .websocket import kernel_websocket_endpoint
from .services import mcp_proxy as mcp_proxy_service
from .services.audit import AuditService

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks."""
    logger.info("PyIDE server starting up")

    # Initialise database tables
    from .db.session import Base, engine
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialised")

    # Initialise audit service
    app.state.audit = AuditService(settings.PYIDE_DATA_DIR)

    # Initialise MCP proxy manager
    manager = mcp_proxy_service.MCPProxyManager(settings.PYIDE_DATA_DIR)
    manager.ensure_config_dirs()
    await manager.load_config()
    mcp_proxy_service.mcp_proxy_manager = manager
    logger.info("MCP proxy manager initialised with %d server(s)", len(manager.servers))

    yield

    # On shutdown: stop all MCP servers, then clean up kernels
    logger.info("PyIDE server shutting down – stopping MCP servers")
    await manager.stop_all()

    logger.info("Terminating all kernels")
    running = await kernel_manager.list_kernels()
    for info in running:
        await kernel_manager.destroy_kernel(info["user_id"])
    logger.info("All kernels terminated")


app = FastAPI(
    title="PyIDE Remote Server",
    description="Remote kernel and multi-user support for PyIDE",
    version="0.2.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_cors_origins = [
    "http://localhost:1420",
    "http://localhost:1421",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://172.17.10.162:3000",
    "http://172.17.10.162:8001",
    "tauri://localhost",
    "https://tauri.localhost",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Attach security-related HTTP response headers to every reply."""
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ---------------------------------------------------------------------------
# Request body size limit middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    """Reject requests whose Content-Length exceeds MAX_REQUEST_SIZE."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.MAX_REQUEST_SIZE:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=413,
            content={"detail": "Request body too large."},
        )
    return await call_next(request)


# ---------------------------------------------------------------------------
# Audit logging middleware
# ---------------------------------------------------------------------------
_AUDIT_PREFIXES = ("/api/v1/auth", "/api/v1/admin")


@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    """Log auth and admin requests to the JSONL audit log."""
    response: Response = await call_next(request)

    path: str = request.url.path
    if any(path.startswith(prefix) for prefix in _AUDIT_PREFIXES):
        audit: AuditService = request.app.state.audit
        client_ip = request.client.host if request.client else None

        # Best-effort: extract user identity from Authorization header
        user_id = "anonymous"
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            from jose import jwt as _jwt, JWTError
            try:
                payload = _jwt.decode(
                    auth_header[7:],
                    settings.SECRET_KEY,
                    algorithms=[settings.ALGORITHM],
                    options={"verify_exp": False},
                )
                user_id = payload.get("sub", "anonymous")
            except (JWTError, Exception):
                pass

        await audit.log(
            user_id=user_id,
            action=request.method,
            resource=path,
            details={"status_code": response.status_code},
            ip_address=client_ip,
        )

    return response

# ---------------------------------------------------------------------------
# REST routers
# ---------------------------------------------------------------------------
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(kernels.router, prefix="/api/v1/kernels", tags=["kernels"])
app.include_router(environments.router, prefix="/api/v1/environments", tags=["environments"])
app.include_router(publishing.router, prefix="/api/v1/publish", tags=["publishing"])
app.include_router(team_memory.router, prefix="/api/v1/team-memory", tags=["team-memory"])
app.include_router(mcp_api.router, prefix="/api/v1/mcp", tags=["mcp"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# WebSocket proxy endpoint
# ---------------------------------------------------------------------------
@app.websocket("/ws/kernel")
async def ws_kernel(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
    session: Optional[str] = Query(default=None),
):
    """WebSocket proxy: client <-> server <-> user's PyKernel subprocess.

    Authenticate via ?token=<JWT>.
    The server creates (or reuses) the user's kernel and forwards all
    messages bidirectionally.
    """
    auth_token = token or session
    await kernel_websocket_endpoint(websocket, token=auth_token)


# Backward-compatible alias so older frontends using /kernel/ws still work
@app.websocket("/kernel/ws")
async def ws_kernel_compat(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
    session: Optional[str] = Query(default=None),
):
    """Compatibility alias for /ws/kernel (legacy path)."""
    auth_token = token or session
    await kernel_websocket_endpoint(websocket, token=auth_token)


# ---------------------------------------------------------------------------
# Health / diagnostics
# ---------------------------------------------------------------------------
@app.get("/health", tags=["meta"])
def health_check():
    return {"status": "ok"}


