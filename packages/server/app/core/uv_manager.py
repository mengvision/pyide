"""UV package manager integration for remote kernel environments.

Provides async utilities for:
- Installing Python versions via `uv python install`
- Creating virtual environments via `uv venv`
- Installing packages via `uv pip install`
- Managing per-user environment templates
"""

import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class UVError(Exception):
    """Raised when a uv command fails."""
    pass


class UVManager:
    """Manages uv operations on the server."""

    def __init__(self, uv_path: Optional[str] = None):
        """Initialize UVManager.
        
        Args:
            uv_path: Path to uv executable. If None, searches PATH.
        """
        self.uv_path = uv_path or "uv"

    async def ensure_uv_installed(self) -> bool:
        """Check if uv is available on the system.
        
        Returns:
            True if uv is installed and accessible.
            
        Raises:
            UVError: If uv is not found.
        """
        try:
            proc = await asyncio.create_subprocess_exec(
                self.uv_path, "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            
            if proc.returncode == 0:
                version = stdout.decode().strip()
                logger.info("UV found: %s", version)
                return True
            else:
                error_msg = stderr.decode().strip()
                raise UVError(f"uv command failed: {error_msg}")
                
        except FileNotFoundError:
            raise UVError(
                "uv is not installed. Install it with:\n"
                "  curl -LsSf https://astral.sh/uv/install.sh | sh\n"
                "Or download from: https://github.com/astral-sh/uv"
            )

    async def install_python_version(self, version: str) -> str:
        """Install a specific Python version using uv.
        
        Args:
            version: Python version string (e.g., "3.12", "3.11.5")
            
        Returns:
            Path to the installed Python executable.
            
        Raises:
            UVError: If installation fails.
        """
        await self.ensure_uv_installed()
        
        logger.info("Installing Python version: %s", version)
        
        proc = await asyncio.create_subprocess_exec(
            self.uv_path, "python", "install", version,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode != 0:
            error_msg = stderr.decode().strip()
            raise UVError(f"Failed to install Python {version}: {error_msg}")
        
        output = stdout.decode().strip()
        logger.info("Python %s installed: %s", version, output)
        
        # Get the path to the installed Python
        return await self._find_python_by_version(version)

    async def create_venv(
        self, 
        venv_path: str, 
        python_version: Optional[str] = None
    ) -> str:
        """Create a virtual environment using uv.
        
        Args:
            venv_path: Path where the venv should be created.
            python_version: Optional Python version to use.
            
        Returns:
            Path to the Python executable in the new venv.
            
        Raises:
            UVError: If venv creation fails.
        """
        await self.ensure_uv_installed()
        
        cmd = [self.uv_path, "venv", venv_path]
        if python_version:
            cmd.extend(["--python", python_version])
        
        logger.info("Creating venv at %s (Python: %s)", venv_path, python_version or "default")
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode != 0:
            error_msg = stderr.decode().strip()
            raise UVError(f"Failed to create venv at {venv_path}: {error_msg}")
        
        logger.info("Venv created successfully at %s", venv_path)
        
        return self._get_python_path(venv_path)

    async def install_packages(
        self, 
        venv_path: str, 
        packages: list[str]
    ) -> None:
        """Install packages into a virtual environment.
        
        Args:
            venv_path: Path to the virtual environment.
            packages: List of package names (with optional versions).
            
        Raises:
            UVError: If package installation fails.
        """
        await self.ensure_uv_installed()
        
        if not packages:
            logger.debug("No packages to install")
            return
        
        python_exe = self._get_python_path(venv_path)
        cmd = [self.uv_path, "pip", "install"] + packages
        
        env = os.environ.copy()
        env["VIRTUAL_ENV"] = venv_path
        
        logger.info(
            "Installing packages in %s: %s",
            venv_path, ", ".join(packages)
        )
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode != 0:
            error_msg = stderr.decode().strip()
            raise UVError(
                f"Failed to install packages in {venv_path}: {error_msg}"
            )
        
        logger.info("Packages installed successfully in %s", venv_path)

    async def list_packages(self, venv_path: str) -> list[dict]:
        """List installed packages in a virtual environment.
        
        Args:
            venv_path: Path to the virtual environment.
            
        Returns:
            List of dicts with 'name' and 'version' keys.
            
        Raises:
            UVError: If listing fails.
        """
        await self.ensure_uv_installed()
        
        cmd = [self.uv_path, "pip", "list", "--format", "json"]
        env = os.environ.copy()
        env["VIRTUAL_ENV"] = venv_path
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode != 0:
            error_msg = stderr.decode().strip()
            raise UVError(f"Failed to list packages: {error_msg}")
        
        packages = json.loads(stdout.decode())
        return packages

    async def get_python_path(self, venv_path: str) -> str:
        """Get the path to Python executable in a venv.
        
        Args:
            venv_path: Path to the virtual environment.
            
        Returns:
            Absolute path to Python executable.
            
        Raises:
            UVError: If Python executable not found.
        """
        python_path = self._get_python_path(venv_path)
        
        if not Path(python_path).exists():
            raise UVError(f"Python executable not found at {python_path}")
        
        return python_path

    def _get_python_path(self, venv_path: str) -> str:
        """Get Python executable path (internal, no existence check).
        
        Handles Windows vs Unix differences.
        """
        if sys.platform == "win32":
            return os.path.join(venv_path, "Scripts", "python.exe")
        else:
            return os.path.join(venv_path, "bin", "python")

    async def _find_python_by_version(self, version: str) -> str:
        """Find Python executable for a specific version installed by uv.
        
        Args:
            version: Python version string.
            
        Returns:
            Path to Python executable.
        """
        # uv typically installs to ~/.local/share/uv/python/
        # We'll use `uv python find` to locate it
        proc = await asyncio.create_subprocess_exec(
            self.uv_path, "python", "find", version,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode == 0:
            return stdout.decode().strip()
        
        # Fallback: search common locations
        home = Path.home()
        search_paths = [
            home / ".local" / "share" / "uv" / "python" / f"cpython-{version}",
            home / ".local" / "share" / "uv" / "python" / f"python{version}",
        ]
        
        for base_path in search_paths:
            if sys.platform == "win32":
                python_path = base_path / "python.exe"
            else:
                python_path = base_path / "bin" / "python"
            
            if python_path.exists():
                return str(python_path)
        
        raise UVError(f"Could not find Python {version} installed by uv")


# Singleton instance
uv_manager = UVManager()
