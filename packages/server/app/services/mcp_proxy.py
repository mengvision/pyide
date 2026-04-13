"""
MCP Proxy Service
=================
Manages MCP server subprocesses on the server side and proxies tool calls
from desktop clients.  Each MCP server is launched as a child process and
communicates via JSON-RPC 2.0 over stdio.
"""

import asyncio
import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class MCPServerProcess:
    """Manages a single MCP server subprocess via stdio (JSON-RPC 2.0)."""

    def __init__(
        self,
        name: str,
        command: str,
        args: List[str] = None,
        env: Dict[str, str] = None,
    ) -> None:
        self.name = name
        self.command = command
        self.args: List[str] = args or []
        self.env: Dict[str, str] = env or {}
        self.process: Optional[subprocess.Popen] = None
        self._request_id: int = 0
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the MCP server subprocess and send the initialize handshake."""
        if self.process and self.process.poll() is None:
            logger.debug("MCP server '%s' is already running", self.name)
            return

        merged_env = {**dict(os.environ), **self.env}
        try:
            self.process = subprocess.Popen(
                [self.command] + self.args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=merged_env,
            )
            logger.info("Started MCP server '%s' (pid=%d)", self.name, self.process.pid)
        except FileNotFoundError as exc:
            raise RuntimeError(
                f"MCP server '{self.name}': command not found – {self.command}"
            ) from exc

        # MCP initialize handshake
        try:
            await self._send_request(
                "initialize",
                {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "pyide-server", "version": "1.0.0"},
                },
            )
            # Send initialized notification (no response expected)
            await self._send_notification("notifications/initialized", {})
        except Exception as exc:
            logger.error(
                "MCP server '%s' initialization failed: %s", self.name, exc
            )
            await self.stop()
            raise

    async def stop(self) -> None:
        """Terminate the MCP server subprocess."""
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Error stopping MCP server '%s': %s", self.name, exc)
            finally:
                self.process = None
            logger.info("Stopped MCP server '%s'", self.name)

    @property
    def is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    # ------------------------------------------------------------------
    # MCP protocol helpers
    # ------------------------------------------------------------------

    async def list_tools(self) -> List[Dict[str, Any]]:
        """Discover available tools from the MCP server."""
        response = await self._send_request("tools/list", {})
        return response.get("tools", [])

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool call and return the raw result dict."""
        return await self._send_request(
            "tools/call",
            {"name": tool_name, "arguments": arguments},
        )

    # ------------------------------------------------------------------
    # Low-level JSON-RPC transport
    # ------------------------------------------------------------------

    async def _send_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send a JSON-RPC 2.0 request and return the result."""
        if not self.is_running:
            raise RuntimeError(f"MCP server '{self.name}' is not running")

        async with self._lock:
            self._request_id += 1
            request = {
                "jsonrpc": "2.0",
                "id": self._request_id,
                "method": method,
                "params": params,
            }
            msg = (json.dumps(request) + "\n").encode()

            loop = asyncio.get_event_loop()

            # Write in executor to avoid blocking the event loop
            await loop.run_in_executor(None, self._write, msg)
            raw = await loop.run_in_executor(None, self._read_line)

        if not raw:
            raise RuntimeError(f"MCP server '{self.name}' returned empty response")

        try:
            envelope = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"MCP server '{self.name}' returned invalid JSON: {raw!r}"
            ) from exc

        if "error" in envelope:
            err = envelope["error"]
            raise RuntimeError(
                f"MCP server '{self.name}' error {err.get('code')}: {err.get('message')}"
            )

        return envelope.get("result", {})

    async def _send_notification(self, method: str, params: Dict[str, Any]) -> None:
        """Send a JSON-RPC 2.0 notification (no response expected)."""
        if not self.is_running:
            return
        notification = {"jsonrpc": "2.0", "method": method, "params": params}
        msg = (json.dumps(notification) + "\n").encode()
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._write, msg)

    def _write(self, data: bytes) -> None:
        assert self.process and self.process.stdin
        self.process.stdin.write(data)
        self.process.stdin.flush()

    def _read_line(self) -> str:
        assert self.process and self.process.stdout
        return self.process.stdout.readline().decode().strip()


# ---------------------------------------------------------------------------
# Manager
# ---------------------------------------------------------------------------


class MCPProxyManager:
    """Manages multiple MCP server processes for the team."""

    def __init__(self, config_dir: str) -> None:
        self.config_dir = Path(config_dir)
        self.servers: Dict[str, MCPServerProcess] = {}

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    async def load_config(self) -> None:
        """Load MCP server configurations from the team config file."""
        config_path = self.config_dir / "team" / "mcp" / "mcp.json"
        if not config_path.exists():
            logger.info("No MCP config found at %s – no servers loaded", config_path)
            return

        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("Failed to read MCP config: %s", exc)
            return

        for name, server_cfg in config.get("servers", {}).items():
            if name not in self.servers:
                self.servers[name] = MCPServerProcess(
                    name=name,
                    command=server_cfg["command"],
                    args=server_cfg.get("args", []),
                    env=server_cfg.get("env", {}),
                )
                logger.info("Registered MCP server '%s'", name)

    def ensure_config_dirs(self) -> None:
        """Create the team MCP config directory and default mcp.json if absent."""
        mcp_dir = self.config_dir / "team" / "mcp"
        mcp_dir.mkdir(parents=True, exist_ok=True)
        mcp_json = mcp_dir / "mcp.json"
        if not mcp_json.exists():
            mcp_json.write_text(
                json.dumps({"servers": {}}, indent=2), encoding="utf-8"
            )
            logger.info("Created default MCP config at %s", mcp_json)

    # ------------------------------------------------------------------
    # Server lifecycle
    # ------------------------------------------------------------------

    async def start_server(self, name: str) -> None:
        """Start a registered MCP server by name."""
        if name not in self.servers:
            raise ValueError(f"Unknown MCP server: '{name}'")
        await self.servers[name].start()

    async def stop_server(self, name: str) -> None:
        """Stop a registered MCP server by name."""
        if name not in self.servers:
            raise ValueError(f"Unknown MCP server: '{name}'")
        await self.servers[name].stop()

    async def stop_all(self) -> None:
        """Stop all running MCP servers (used during application shutdown)."""
        for server in self.servers.values():
            if server.is_running:
                try:
                    await server.stop()
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Error stopping '%s': %s", server.name, exc)

    # ------------------------------------------------------------------
    # Tool discovery & invocation
    # ------------------------------------------------------------------

    async def list_all_tools(self) -> Dict[str, List[Dict[str, Any]]]:
        """Return tools grouped by server name for all running servers."""
        result: Dict[str, List[Dict[str, Any]]] = {}
        for name, server in self.servers.items():
            if server.is_running:
                try:
                    result[name] = await server.list_tools()
                except Exception as exc:  # noqa: BLE001
                    logger.error("Failed to list tools for '%s': %s", name, exc)
                    result[name] = []
        return result

    async def call_tool(
        self, server_name: str, tool_name: str, arguments: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Proxy a tool call to the specified MCP server."""
        if server_name not in self.servers:
            raise ValueError(f"Unknown MCP server: '{server_name}'")
        server = self.servers[server_name]
        if not server.is_running:
            raise RuntimeError(
                f"MCP server '{server_name}' is not running. "
                "Start it first via POST /api/v1/mcp/servers/{name}/start"
            )
        return await server.call_tool(tool_name, arguments)

    def get_server_status(self) -> List[Dict[str, Any]]:
        """Return a lightweight status list for all registered servers."""
        return [
            {"name": name, "running": server.is_running}
            for name, server in self.servers.items()
        ]


# ---------------------------------------------------------------------------
# Module-level singleton (initialised in main.py lifespan)
# ---------------------------------------------------------------------------

mcp_proxy_manager: Optional[MCPProxyManager] = None


def get_mcp_proxy_manager() -> MCPProxyManager:
    """Return the global MCPProxyManager, raising if not yet initialised."""
    if mcp_proxy_manager is None:
        raise RuntimeError(
            "MCPProxyManager has not been initialised. "
            "Check that the application lifespan has run."
        )
    return mcp_proxy_manager
