"""WebSocket server for PyKernel.

Implements a JSON-RPC 2.0-inspired protocol over WebSockets.  Each client
connection gets its own request handler; code execution is serialised via
an asyncio.Lock so only one cell runs at a time.

Message formats
---------------
Request (client → server)::

    { "id": "<uuid>", "method": "execute"|"inspect"|"inspect_all"|"interrupt"|"complete",
      "params": { ... } }

Success response (server → client)::

    { "id": "<uuid>", "result": { ... } }

Error response (server → client)::

    { "id": "<uuid>", "error": { "code": <int>, "message": "<str>", "data": { ... } } }

Stream message (server → client, no ``id``)::

    { "stream": "stdout"|"stderr"|"display_data"|"execute_result", "data": { ... } }
"""

import asyncio
import json
import logging
from typing import Any, Optional

import websockets
import websockets.exceptions
import websockets.server

from .executor import Executor
from .state_manager import StateManager
from .checkpoint import CheckpointManager

logger = logging.getLogger(__name__)

# JSON-RPC error codes
_ERR_PARSE = -32700       # Parse error
_ERR_INVALID = -32600     # Invalid request
_ERR_METHOD = -32601      # Method not found
_ERR_PARAMS = -32602      # Invalid params
_ERR_INTERNAL = -32603    # Internal error
_ERR_BUSY = -32000        # Kernel busy (custom)


class WebSocketServer:
    """Async WebSocket server that routes JSON-RPC messages to kernel services.

    Args:
        host: Bind address (default ``"127.0.0.1"``).
        port: Bind port (default ``8765``).
    """

    def __init__(self, host: str = "127.0.0.1", port: int = 8765) -> None:
        self._host = host
        self._port = port
        self._executor = Executor()
        self._state_manager = StateManager(self._executor.namespace)
        self._checkpoint_manager = CheckpointManager(self._executor.namespace)
        # Wire the checkpoint manager into the executor for %checkpoint magic
        self._executor.set_checkpoint_manager(self._checkpoint_manager)
        # Only one cell executes at a time
        self._exec_lock = asyncio.Lock()
        self._server: Optional[websockets.server.WebSocketServer] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the WebSocket server and begin accepting connections."""
        self._server = await websockets.serve(
            self._handle_connection,
            self._host,
            self._port,
            ping_interval=30,
            ping_timeout=10,
        )
        # Start Layer 1 auto-save (variable metadata, every 60 s)
        self._checkpoint_manager.start_auto_save(interval=60)
        logger.info("WebSocket server listening on ws://%s:%d", self._host, self._port)

    async def stop(self) -> None:
        """Stop the WebSocket server gracefully."""
        self._checkpoint_manager.stop_auto_save()
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
            logger.info("WebSocket server stopped.")

    # ------------------------------------------------------------------
    # Connection handler
    # ------------------------------------------------------------------

    async def _handle_connection(
        self, ws: websockets.server.WebSocketServerProtocol
    ) -> None:
        """Handle a single client connection for its lifetime.

        Args:
            ws: The WebSocket connection object.
        """
        remote = ws.remote_address
        logger.info("Client connected: %s", remote)
        try:
            async for raw in ws:
                await self._dispatch(raw, ws)
        except websockets.exceptions.ConnectionClosedOK:
            pass
        except websockets.exceptions.ConnectionClosedError as exc:
            logger.debug("Connection closed with error from %s: %s", remote, exc)
        except Exception:
            logger.exception("Unexpected error in connection handler for %s", remote)
        finally:
            logger.info("Client disconnected: %s", remote)

    # ------------------------------------------------------------------
    # Message dispatch
    # ------------------------------------------------------------------

    async def _dispatch(
        self, raw: Any, ws: websockets.server.WebSocketServerProtocol
    ) -> None:
        """Parse and dispatch a single incoming message.

        Args:
            raw: Raw message received from the WebSocket (str or bytes).
            ws: The WebSocket connection to reply to.
        """
        # --- Parse JSON ---
        try:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            msg = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            await self._send_error(ws, None, _ERR_PARSE, f"Parse error: {exc}")
            return

        if not isinstance(msg, dict):
            await self._send_error(ws, None, _ERR_INVALID, "Request must be a JSON object")
            return

        req_id: Optional[str] = msg.get("id")
        method: Optional[str] = msg.get("method")
        params: Any = msg.get("params", {})

        if not isinstance(method, str):
            await self._send_error(ws, req_id, _ERR_INVALID, "'method' must be a string")
            return

        if not isinstance(params, dict):
            await self._send_error(ws, req_id, _ERR_PARAMS, "'params' must be an object")
            return

        logger.debug("Dispatch method=%s id=%s", method, req_id)

        # --- Route ---
        handlers = {
            "execute": self._handle_execute,
            "inspect": self._handle_inspect,
            "inspect_all": self._handle_inspect_all,
            "interrupt": self._handle_interrupt,
            "complete": self._handle_complete,
            "checkpoint_save": self._handle_checkpoint_save,
            "checkpoint_restore": self._handle_checkpoint_restore,
            "checkpoint_list": self._handle_checkpoint_list,
            "checkpoint_snapshot": self._handle_checkpoint_snapshot,
        }

        handler = handlers.get(method)
        if handler is None:
            await self._send_error(ws, req_id, _ERR_METHOD, f"Unknown method: '{method}'")
            return

        try:
            result = await handler(params, ws)
            if req_id is not None:
                await self._send_result(ws, req_id, result)
        except _KernelError as exc:
            await self._send_error(ws, req_id, exc.code, exc.message, exc.data)
        except Exception:
            logger.exception("Unhandled exception in method '%s'", method)
            await self._send_error(ws, req_id, _ERR_INTERNAL, "Internal kernel error")

    # ------------------------------------------------------------------
    # Method handlers
    # ------------------------------------------------------------------

    async def _handle_execute(
        self, params: dict, ws: websockets.server.WebSocketServerProtocol
    ) -> dict:
        """Handle an ``execute`` request.

        Expected params::

            { "code": "<source>", "cell_id": "<optional str>" }

        Args:
            params: Request params dict.
            ws: Active WebSocket connection used for streaming output.

        Returns:
            Result dict with ``status`` and ``execution_count``.

        Raises:
            _KernelError: If the kernel is already busy.
        """
        code = params.get("code", "")
        cell_id = params.get("cell_id")

        if not isinstance(code, str):
            raise _KernelError(_ERR_PARAMS, "'code' must be a string")

        if self._exec_lock.locked():
            raise _KernelError(_ERR_BUSY, "Kernel is busy executing another cell")

        async with self._exec_lock:
            result = await self._executor.execute(
                code, ws, cell_id=cell_id,
                state_manager=self._state_manager,
            )

        return result

    async def _handle_inspect(
        self, params: dict, ws: websockets.server.WebSocketServerProtocol
    ) -> dict:
        """Handle an ``inspect`` request.

        Expected params::

            { "name": "<variable_name>" }

        Args:
            params: Request params dict.
            ws: Not used directly (required by handler signature).

        Returns:
            Variable info dict from :meth:`StateManager.inspect`.

        Raises:
            _KernelError: If ``name`` is missing or not found.
        """
        name = params.get("name")
        if not isinstance(name, str) or not name:
            raise _KernelError(_ERR_PARAMS, "'name' must be a non-empty string")
        try:
            return self._state_manager.inspect(name)
        except KeyError as exc:
            raise _KernelError(_ERR_PARAMS, str(exc)) from exc

    async def _handle_inspect_all(
        self, params: dict, ws: websockets.server.WebSocketServerProtocol
    ) -> dict:
        """Handle an ``inspect_all`` request.

        Args:
            params: Ignored.
            ws: Not used directly (required by handler signature).

        Returns:
            Dict with ``variables`` key containing a list of variable info dicts.
        """
        variables = self._state_manager.inspect_all()
        return {"variables": variables}

    async def _handle_interrupt(
        self, params: dict, ws: websockets.server.WebSocketServerProtocol
    ) -> dict:
        """Handle an ``interrupt`` request.

        Args:
            params: Ignored.
            ws: Not used directly (required by handler signature).

        Returns:
            ``{ "status": "ok" }``
        """
        self._executor.interrupt()
        logger.info("Interrupt requested by client")
        return {"status": "ok"}

    async def _handle_complete(
        self, params: dict, ws: websockets.server.WebSocketServerProtocol
    ) -> dict:
        """Handle a ``complete`` request (code completion via jedi).

        Expected params::

            { "code": "<source>", "cursor_pos": <int> }

        Args:
            params: Request params dict.
            ws: Not used directly (required by handler signature).

        Returns:
            Dict with ``completions`` list, each item having ``text``,
            ``type``, and ``description`` keys.
        """
        code = params.get("code", "")
        cursor_pos = params.get("cursor_pos", len(code) if isinstance(code, str) else 0)

        if not isinstance(code, str):
            raise _KernelError(_ERR_PARAMS, "'code' must be a string")
        if not isinstance(cursor_pos, int):
            raise _KernelError(_ERR_PARAMS, "'cursor_pos' must be an integer")

        completions = await asyncio.get_running_loop().run_in_executor(
            None, _get_jedi_completions, code, cursor_pos, self._executor.namespace
        )
        return {"completions": completions}

    async def _handle_checkpoint_save(
        self, params: dict, ws: websockets.server.WebSocketServerProtocol
    ) -> dict:
        """Handle a ``checkpoint_save`` request.

        Expected params::

            { "name": "<optional checkpoint name>" }

        Returns:
            ``{ "status": "ok", "message": "..." }``
        """
        name = params.get("name") or None
        loop = asyncio.get_running_loop()
        message = await loop.run_in_executor(
            None, self._checkpoint_manager.save_checkpoint, name
        )
        return {"status": "ok", "message": message}

    async def _handle_checkpoint_restore(
        self, params: dict, ws: websockets.server.WebSocketServerProtocol
    ) -> dict:
        """Handle a ``checkpoint_restore`` request.

        Expected params::

            { "name": "<checkpoint name>", "variables": ["var1", ...] }

        Returns:
            ``{ "status": "ok", "message": "..." }``
        """
        name = params.get("name")
        if not isinstance(name, str) or not name:
            raise _KernelError(_ERR_PARAMS, "'name' must be a non-empty string")
        variables = params.get("variables") or None
        if variables is not None and not isinstance(variables, list):
            raise _KernelError(_ERR_PARAMS, "'variables' must be a list of strings")

        loop = asyncio.get_running_loop()
        message = await loop.run_in_executor(
            None, self._checkpoint_manager.restore_checkpoint, name, variables
        )
        return {"status": "ok", "message": message}

    async def _handle_checkpoint_list(
        self, params: dict, ws: websockets.server.WebSocketServerProtocol
    ) -> dict:
        """Handle a ``checkpoint_list`` request.

        Returns::

            { "checkpoints": [ { "name": ..., "timestamp": ..., "variables": [...] }, ... ] }
        """
        checkpoints = []
        import json as _json
        for meta_file in sorted(self._checkpoint_manager.checkpoint_dir.glob("*.json")):
            try:
                meta = _json.loads(meta_file.read_text(encoding="utf-8"))
                checkpoints.append(meta)
            except Exception:
                pass
        return {"checkpoints": checkpoints}

    async def _handle_checkpoint_snapshot(
        self, params: dict, ws: websockets.server.WebSocketServerProtocol
    ) -> dict:
        """Handle a ``checkpoint_snapshot`` request.

        Expected params::

            { "description": "<optional description>" }

        Returns:
            ``{ "status": "ok", "message": "..." }``
        """
        description = params.get("description") or ""
        loop = asyncio.get_running_loop()
        message = await loop.run_in_executor(
            None, self._checkpoint_manager.save_snapshot, description
        )
        return {"status": "ok", "message": message}

    # ------------------------------------------------------------------
    # Response helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _send_result(
        ws: websockets.server.WebSocketServerProtocol,
        req_id: str,
        result: Any,
    ) -> None:
        """Send a success response.

        Args:
            ws: WebSocket connection.
            req_id: The request ``id`` to echo back.
            result: The result payload (must be JSON-serializable).
        """
        try:
            await ws.send(json.dumps({"id": req_id, "result": result}))
        except Exception:
            logger.debug("Failed to send result for id=%s", req_id, exc_info=True)

    @staticmethod
    async def _send_error(
        ws: websockets.server.WebSocketServerProtocol,
        req_id: Optional[str],
        code: int,
        message: str,
        data: Optional[dict] = None,
    ) -> None:
        """Send an error response.

        Args:
            ws: WebSocket connection.
            req_id: The request ``id`` (may be ``None`` for parse errors).
            code: JSON-RPC error code.
            message: Human-readable error message.
            data: Optional additional error data.
        """
        error: dict = {"code": code, "message": message}
        if data is not None:
            error["data"] = data
        try:
            await ws.send(json.dumps({"id": req_id, "error": error}))
        except Exception:
            logger.debug("Failed to send error response", exc_info=True)


# ---------------------------------------------------------------------------
# Jedi completion helper (runs in thread pool)
# ---------------------------------------------------------------------------

def _get_jedi_completions(
    code: str, cursor_pos: int, namespace: dict
) -> list:
    """Return jedi completions for *code* at *cursor_pos*.

    Args:
        code: Python source being edited.
        cursor_pos: Byte/character offset of the cursor.
        namespace: The kernel execution namespace (used as ``locals`` for
            jedi's interpreter context).

    Returns:
        A list of completion dicts, each with ``text``, ``type``, and
        ``description`` keys.
    """
    try:
        import jedi  # optional; installed via pyproject.toml dependency

        # Translate flat cursor_pos into (line, column)
        lines = code[:cursor_pos].split("\n")
        line = len(lines)
        col = len(lines[-1])

        script = jedi.Interpreter(
            code,
            [namespace],
            path=None,
        )
        raw_completions = script.complete(line, col)
        return [
            {
                "text": c.name,
                "type": c.type,
                "description": c.description,
            }
            for c in raw_completions[:100]  # cap at 100
        ]
    except Exception:
        logger.debug("Jedi completion failed", exc_info=True)
        return []


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------

class _KernelError(Exception):
    """Internal exception for expected kernel-level errors.

    Args:
        code: JSON-RPC numeric error code.
        message: Human-readable description.
        data: Optional dict of extra context.
    """

    def __init__(
        self, code: int, message: str, data: Optional[dict] = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data
