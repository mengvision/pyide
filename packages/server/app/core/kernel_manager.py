"""Real subprocess-based kernel manager.

Each user gets one PyKernel process running on a dedicated port.
Port range is configured via settings (default 9000–9999).
Supports uv-managed virtual environments via environment templates.
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Optional

import websockets
from websockets.exceptions import WebSocketException

from .config import settings
from .uv_manager import uv_manager, UVError

logger = logging.getLogger(__name__)

PORT_RANGE_START = settings.KERNEL_PORT_START
PORT_RANGE_END = settings.KERNEL_PORT_END


@dataclass
class KernelProcess:
    user_id: int
    username: str
    port: int
    process: subprocess.Popen
    workspace_dir: str
    env_template_id: Optional[int] = None
    venv_path: Optional[str] = None
    ws_url: str = field(init=False)

    def __post_init__(self):
        self.ws_url = f"ws://127.0.0.1:{self.port}"

    @property
    def is_alive(self) -> bool:
        return self.process.poll() is None


class KernelManager:
    """Manages per-user PyKernel subprocess instances."""

    def __init__(self):
        # user_id (int) -> KernelProcess
        self._kernels: dict[int, KernelProcess] = {}
        self._used_ports: set[int] = set()
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Port allocation
    # ------------------------------------------------------------------

    def _allocate_port(self) -> int:
        for port in range(PORT_RANGE_START, PORT_RANGE_END + 1):
            if port not in self._used_ports:
                self._used_ports.add(port)
                return port
        raise RuntimeError("No available ports in the kernel port range")

    def _release_port(self, port: int) -> None:
        self._used_ports.discard(port)

    # ------------------------------------------------------------------
    # Workspace helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_workspace_dir(username: str) -> str:
        base = os.environ.get("PYIDE_DATA_DIR", settings.PYIDE_DATA_DIR)
        workspace = os.path.join(base, "users", username, "workspace")
        os.makedirs(workspace, exist_ok=True)
        return workspace

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def _wait_for_kernel(self, port: int, timeout: float = 10.0) -> bool:
        """Try to connect to the kernel WebSocket until it's ready."""
        url = f"ws://127.0.0.1:{port}"
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            try:
                async with websockets.connect(url, open_timeout=1):
                    return True
            except (OSError, WebSocketException, asyncio.TimeoutError):
                await asyncio.sleep(0.3)
        return False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def create_kernel(
        self,
        user_id: int,
        username: str,
        env_template_id: Optional[int] = None,
    ) -> KernelProcess:
        """Start a new PyKernel process for the given user.
        
        Args:
            user_id: User ID from database.
            username: Username for workspace directory.
            env_template_id: Optional environment template ID for uv-managed venv.
        """
        async with self._lock:
            # Kill any existing kernel first
            if user_id in self._kernels:
                await self._destroy_kernel_locked(user_id)

            port = self._allocate_port()
            workspace_dir = self._get_workspace_dir(username)

            # Determine Python executable and venv path
            python_exe = sys.executable  # Default: system Python
            venv_path = None
            
            if env_template_id:
                try:
                    venv_path = await self._ensure_user_venv(
                        username, env_template_id
                    )
                    python_exe = await uv_manager.get_python_path(venv_path)
                    logger.info(
                        "Using uv-managed venv for user %s: %s",
                        username, venv_path,
                    )
                except UVError as exc:
                    logger.warning(
                        "Failed to create uv venv, falling back to system Python: %s",
                        exc,
                    )
                    # Fallback to system Python with warning
                    venv_path = None
                    python_exe = sys.executable

            cmd = [
                python_exe, "-m", "pykernel",
                "--port", str(port),
                "--host", "127.0.0.1",
                "--log-level", "WARNING",
            ]

            env = os.environ.copy()
            env["PYIDE_USER_ID"] = str(user_id)
            env["PYIDE_USERNAME"] = username
            
            # Set VIRTUAL_ENV if using uv-managed venv
            if venv_path:
                env["VIRTUAL_ENV"] = venv_path
                # Prepend venv's bin/Scripts to PATH
                if sys.platform == "win32":
                    env["PATH"] = f"{os.path.join(venv_path, 'Scripts')};{env['PATH']}"
                else:
                    env["PATH"] = f"{os.path.join(venv_path, 'bin')}:{env['PATH']}"

            logger.info(
                "Starting kernel for user %s (id=%s) on port %s (env_template=%s)",
                username, user_id, port, env_template_id,
            )

            try:
                proc = subprocess.Popen(
                    cmd,
                    cwd=workspace_dir,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
            except FileNotFoundError as exc:
                self._release_port(port)
                raise RuntimeError(
                    f"Could not start pykernel – make sure it is installed: {exc}"
                ) from exc

            kp = KernelProcess(
                user_id=user_id,
                username=username,
                port=port,
                process=proc,
                workspace_dir=workspace_dir,
                env_template_id=env_template_id,
                venv_path=venv_path,
            )
            self._kernels[user_id] = kp

        # Wait outside the lock so health-check I/O doesn't block other ops
        ready = await self._wait_for_kernel(port)
        if not ready:
            async with self._lock:
                await self._destroy_kernel_locked(user_id)
            raise RuntimeError(
                f"Kernel for user {username} did not become ready in time"
            )

        logger.info("Kernel ready for user %s on port %s", username, port)
        return kp

    async def get_kernel(self, user_id: int) -> Optional[KernelProcess]:
        """Return the kernel for a user if it exists and is alive."""
        async with self._lock:
            kp = self._kernels.get(user_id)
            if kp is None:
                return None
            if not kp.is_alive:
                logger.warning("Kernel for user_id=%s has died, cleaning up", user_id)
                self._release_port(kp.port)
                del self._kernels[user_id]
                return None
            return kp

    async def get_or_create_kernel(self, user_id: int, username: str) -> KernelProcess:
        """Return existing kernel or create a new one."""
        kp = await self.get_kernel(user_id)
        if kp is not None:
            return kp
        return await self.create_kernel(user_id, username)

    async def destroy_kernel(self, user_id: int) -> None:
        """Terminate and remove a user's kernel."""
        async with self._lock:
            await self._destroy_kernel_locked(user_id)

    async def _destroy_kernel_locked(self, user_id: int) -> None:
        """Must be called while holding self._lock."""
        kp = self._kernels.pop(user_id, None)
        if kp is None:
            return
        logger.info("Destroying kernel for user_id=%s (port %s)", user_id, kp.port)
        try:
            if kp.is_alive:
                kp.process.terminate()
                try:
                    kp.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    kp.process.kill()
                    kp.process.wait()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Error terminating kernel process: %s", exc)
        finally:
            self._release_port(kp.port)

    async def health_check(self, user_id: int) -> bool:
        """Return True if the kernel is alive and accepting connections."""
        kp = await self.get_kernel(user_id)
        if kp is None:
            return False
        try:
            async with websockets.connect(kp.ws_url, open_timeout=2):
                return True
        except Exception:  # noqa: BLE001
            return False

    async def list_kernels(self) -> list[dict]:
        """Return a summary of all running kernels."""
        async with self._lock:
            result = []
            for user_id, kp in list(self._kernels.items()):
                result.append({
                    "user_id": user_id,
                    "username": kp.username,
                    "port": kp.port,
                    "alive": kp.is_alive,
                    "workspace_dir": kp.workspace_dir,
                })
            return result

    async def cleanup_dead_kernels(self) -> int:
        """Remove dead kernels. Returns count removed."""
        removed = 0
        async with self._lock:
            dead = [uid for uid, kp in self._kernels.items() if not kp.is_alive]
            for uid in dead:
                kp = self._kernels.pop(uid)
                self._release_port(kp.port)
                removed += 1
        return removed

    # ------------------------------------------------------------------
    # UV environment helpers
    # ------------------------------------------------------------------

    async def _ensure_user_venv(
        self,
        username: str,
        env_template_id: int,
    ) -> str:
        """Create user's venv from template if it doesn't exist.
        
        Returns:
            Path to the user's virtual environment.
        """
        # Import here to avoid circular dependency
        from ..db.session import SessionLocal
        from ..db.models import EnvironmentTemplate
        
        db = SessionLocal()
        try:
            template = db.query(EnvironmentTemplate).filter(
                EnvironmentTemplate.id == env_template_id
            ).first()
            
            if not template:
                raise UVError(f"Environment template {env_template_id} not found")
            
            if not template.is_active:
                raise UVError(f"Environment template '{template.name}' is not active")
            
            # User's venv path: /pyide-data/users/{username}/.venv/{template_name}/
            workspace_dir = self._get_workspace_dir(username)
            user_venv_path = os.path.join(workspace_dir, ".venv", template.name)
            
            # Check if venv already exists
            if os.path.exists(user_venv_path):
                logger.debug(
                    "User %s venv already exists: %s",
                    username, user_venv_path,
                )
                return user_venv_path
            
            # Create venv (lazy initialization)
            logger.info(
                "Creating uv venv for user %s from template '%s'",
                username, template.name,
            )
            
            packages = json.loads(template.packages)
            
            # Install Python version if needed
            await uv_manager.install_python_version(template.python_version)
            
            # Create venv
            await uv_manager.create_venv(user_venv_path, template.python_version)
            
            # Install packages
            if packages:
                await uv_manager.install_packages(user_venv_path, packages)
            
            logger.info(
                "Successfully created venv for user %s: %s (%d packages)",
                username, user_venv_path, len(packages),
            )
            
            return user_venv_path
            
        finally:
            db.close()


# Singleton instance – import this everywhere
kernel_manager = KernelManager()
