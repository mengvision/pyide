"""Code execution engine for PyKernel.

Executes Python code in a shared namespace, captures stdout/stderr,
detects special result types (DataFrame, Plotly, matplotlib), and
sends stream messages via WebSocket.
"""

import ast
import asyncio
import ctypes
import io
import json
import logging
import sys
import threading
import traceback
from typing import Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .checkpoint import CheckpointManager

logger = logging.getLogger(__name__)


class StreamCapture(io.TextIOBase):
    """Captures writes and forwards them to a WebSocket connection in real time."""

    def __init__(self, stream_type: str, ws: Any, loop: asyncio.AbstractEventLoop, cell_id: Optional[str] = None) -> None:
        """Initialize the stream capture.

        Args:
            stream_type: Either "stdout" or "stderr".
            ws: The WebSocket connection to send data to.
            loop: The asyncio event loop to schedule sends on.
            cell_id: Optional cell identifier to include in stream messages.
        """
        super().__init__()
        self.stream_type = stream_type
        self.ws = ws
        self.loop = loop
        self.cell_id = cell_id
        self._buffer = io.StringIO()

    def write(self, text: str) -> int:  # type: ignore[override]
        """Write text and forward it to WebSocket.

        Args:
            text: The text to write/stream.

        Returns:
            Number of characters written.
        """
        if text:
            self._buffer.write(text)
            asyncio.run_coroutine_threadsafe(self._send(text), self.loop)
        return len(text) if text else 0

    def flush(self) -> None:
        """No-op flush (sends happen immediately on write)."""

    async def _send(self, text: str) -> None:
        """Send a stream message over WebSocket."""
        try:
            msg = {
                "stream": self.stream_type,
                "data": {"text/plain": text},
            }
            if self.cell_id is not None:
                msg["cell_id"] = self.cell_id
            await self.ws.send(json.dumps(msg))
        except Exception:
            logger.debug("Failed to send stream message", exc_info=True)

    def getvalue(self) -> str:
        """Return all captured text."""
        return self._buffer.getvalue()


def _serialize_result(result: Any) -> dict:
    """Serialize an execution result to a wire-format dict.

    Handles special types:
      - pandas DataFrame  -> ``{ _type: "dataframe", ... }``
      - plotly Figure     -> ``{ _type: "plotly", ... }``
      - matplotlib Figure -> base64 PNG or forwarded to plotly
      - everything else   -> ``text/plain`` repr

    Args:
        result: The Python object returned by the executed code.

    Returns:
        A dict with a ``mime`` key and a ``content`` key suitable for
        embedding in a WebSocket message.
    """
    # --- pandas DataFrame ---
    if (
        type(result).__name__ == "DataFrame"
        and hasattr(result, "to_dict")
        and hasattr(result, "columns")
        and hasattr(result, "shape")
    ):
        try:
            rows, cols = result.shape
            # Safely convert columns to list of strings
            columns = [str(c) for c in result.columns.tolist()]
            # Limit to first 50 rows to avoid huge payloads
            preview = result.head(50)
            data = [
                [_json_safe(v) for v in row]
                for row in preview.values.tolist()
            ]
            return {
                "mime": "application/json",
                "content": {
                    "_type": "dataframe",
                    "columns": columns,
                    "data": data,
                    "shape": [rows, cols],
                },
            }
        except Exception:
            logger.debug("DataFrame serialization failed", exc_info=True)

    # --- Plotly Figure ---
    if (
        hasattr(result, "to_dict")
        and type(result).__module__ is not None
        and type(result).__module__.startswith("plotly")
    ):
        try:
            return {
                "mime": "application/json",
                "content": {
                    "_type": "plotly",
                    "figure": result.to_dict(),
                },
            }
        except Exception:
            logger.debug("Plotly serialization failed", exc_info=True)

    # --- matplotlib Figure ---
    if (
        type(result).__module__ is not None
        and (
            type(result).__module__.startswith("matplotlib")
            or type(result).__name__ in ("Figure", "Axes", "AxesSubplot")
        )
        and hasattr(result, "savefig")
    ):
        try:
            import base64

            buf = io.BytesIO()
            result.savefig(buf, format="png", bbox_inches="tight")
            buf.seek(0)
            encoded = base64.b64encode(buf.read()).decode("ascii")
            return {
                "mime": "image/png",
                "content": encoded,
            }
        except Exception:
            logger.debug("matplotlib serialization failed", exc_info=True)

    # --- Fallback: text/plain ---
    try:
        text = repr(result)
    except Exception:
        text = f"<{type(result).__name__}>"
    return {
        "mime": "text/plain",
        "content": text,
    }


def _json_safe(value: Any) -> Any:
    """Convert a value to something JSON-serializable."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    try:
        import math

        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return str(value)
    except Exception:
        pass
    try:
        return str(value)
    except Exception:
        return None


def _split_last_expr(source: str) -> tuple[Optional[str], Optional[str]]:
    """Split source into (body_without_last_expr, last_expr_source).

    If the last statement is an expression, return
    (everything else, last expression source).  Otherwise return
    (original source, None).

    Args:
        source: Python source code.

    Returns:
        Tuple of (body_source_or_None, last_expr_source_or_None).
    """
    try:
        tree = ast.parse(source, mode="exec")
    except SyntaxError:
        return source, None

    if not tree.body:
        return source, None

    last_node = tree.body[-1]
    if not isinstance(last_node, ast.Expr):
        return source, None

    lines = source.splitlines(keepends=True)
    # ast line numbers are 1-based
    split_lineno = last_node.lineno - 1  # 0-based index
    body_source = "".join(lines[:split_lineno]) if split_lineno > 0 else None
    expr_source = "".join(lines[split_lineno:])
    return body_source, expr_source


class Executor:
    """Stateful Python code executor.

    Runs code in a persistent namespace, captures I/O, serializes results,
    and supports interruption via threading.Event.
    """

    def __init__(self) -> None:
        """Initialize the executor with a fresh namespace."""
        self._namespace: dict = {"__builtins__": __builtins__}
        self._interrupt_event = threading.Event()
        self._executing = False
        self._execution_count = 0
        self._executing_thread: Optional[threading.Thread] = None
        self._checkpoint_manager: Optional["CheckpointManager"] = None

    def set_checkpoint_manager(self, manager: "CheckpointManager") -> None:
        """Attach a :class:`CheckpointManager` for magic command handling.

        Args:
            manager: The checkpoint manager instance to use.
        """
        self._checkpoint_manager = manager

    @property
    def namespace(self) -> dict:
        """The shared execution namespace (globals dict)."""
        return self._namespace

    @property
    def is_executing(self) -> bool:
        """True if code is currently being executed."""
        return self._executing

    async def execute(
        self, code: str, ws: Any, cell_id: Optional[str] = None,
        state_manager: Any = None,
    ) -> dict:
        """Execute Python code and stream output via WebSocket.

        Runs the code in a background thread so the asyncio event loop
        remains responsive.  Stdout/stderr are forwarded to the WebSocket
        in real time via :class:`StreamCapture`.

        Automatically intercepts magic commands (``%``, ``%%``) and shell
        escapes (``!``) before they reach ``exec``.

        Args:
            code: Python source code to execute.
            ws: The active WebSocket connection.
            cell_id: Optional identifier for the cell being executed.
            state_manager: Optional :class:`~pykernel.state_manager.StateManager`
                instance used by magic commands.

        Returns:
            A result dict: ``{ "status": "ok"|"error", ... }``.
        """
        if not code or not code.strip():
            return {"status": "ok", "execution_count": self._execution_count}

        # ----------------------------------------------------------------
        # Magic / shell-escape pre-processing
        # ----------------------------------------------------------------
        try:
            from .magic_handler import transform_code as _transform
            transformed, magic_result = _transform(
                code, self._namespace, state_manager
            )
        except Exception:
            logger.debug("Magic transform failed, falling through to exec", exc_info=True)
            transformed, magic_result = code, None

        if magic_result is not None:
            # The entire cell was a magic command — stream the result and return
            self._execution_count += 1
            await _send_magic_result(magic_result, self._execution_count, ws)
            return {"status": "ok", "execution_count": self._execution_count}

        if transformed is not None:
            code = transformed

        # --- Legacy %checkpoint magic (handled by CheckpointManager) ---
        stripped_code = code.strip()
        if stripped_code.startswith("%checkpoint"):
            checkpoint_result = self._try_handle_magic(stripped_code)
            if checkpoint_result is not None:
                self._execution_count += 1
                try:
                    stream_msg = {
                        "stream": "stdout",
                        "data": {"text/plain": checkpoint_result + "\n"},
                    }
                    await ws.send(json.dumps(stream_msg))
                except Exception:
                    pass
                return {"status": "ok", "execution_count": self._execution_count}

        self._execution_count += 1
        self._executing = True
        self._interrupt_event.clear()

        loop = asyncio.get_running_loop()
        result_holder: list = []  # [result_dict]

        def _run() -> None:
            """Thread target: execute code and populate result_holder."""
            stdout_cap = StreamCapture("stdout", ws, loop, cell_id=cell_id)
            stderr_cap = StreamCapture("stderr", ws, loop, cell_id=cell_id)

            result: Any = None
            exec_error: Optional[dict] = None

            try:
                with (
                    _replace_stream("stdout", stdout_cap),
                    _replace_stream("stderr", stderr_cap),
                ):
                    body_src, expr_src = _split_last_expr(code)

                    # Execute body (all statements except maybe the last expr)
                    if body_src and body_src.strip():
                        body_code = compile(body_src, "<cell>", "exec")
                        exec(body_code, self._namespace)  # noqa: S102

                    # Evaluate last expression if present
                    if expr_src and expr_src.strip():
                        try:
                            expr_code = compile(expr_src.strip(), "<cell>", "eval")
                            result = eval(expr_code, self._namespace)  # noqa: S307
                        except SyntaxError:
                            # Not a valid expression on its own; exec it instead
                            full_code = compile(code, "<cell>", "exec")
                            exec(full_code, self._namespace)  # noqa: S102
                            result = None

            except KeyboardInterrupt:
                exec_error = {
                    "code": -32001,
                    "message": "KeyboardInterrupt",
                    "data": {"traceback": ["KeyboardInterrupt"]},
                }
            except SystemExit as exc:
                exec_error = {
                    "code": -32002,
                    "message": f"SystemExit: {exc.code}",
                    "data": {"traceback": [f"SystemExit: {exc.code}"]},
                }
            except Exception:  # noqa: BLE001
                tb_lines = traceback.format_exc().splitlines()
                exec_error = {
                    "code": -32000,
                    "message": tb_lines[-1] if tb_lines else "Runtime error",
                    "data": {
                        "traceback": traceback.format_exc().splitlines(),
                        "ename": type(sys.exc_info()[1]).__name__,
                        "evalue": str(sys.exc_info()[1]),
                    },
                }
            finally:
                self._executing = False

            result_holder.append((result, exec_error))

        # Run in a thread pool so the event loop stays free
        thread = threading.Thread(target=_run, daemon=True, name="pykernel-exec")
        self._executing_thread = thread
        thread.start()

        # Wait for thread completion asynchronously
        await loop.run_in_executor(None, thread.join)
        self._executing_thread = None

        if not result_holder:
            return {
                "status": "error",
                "execution_count": self._execution_count,
                "error": {"code": -32099, "message": "Execution did not complete"},
            }

        result, exec_error = result_holder[0]

        if exec_error:
            return {
                "status": "error",
                "execution_count": self._execution_count,
                "error": exec_error,
            }

        # Send execute_result if there is a non-None result
        if result is not None:
            serialized = _serialize_result(result)
            result_msg = {
                "stream": "execute_result",
                "execution_count": self._execution_count,
                "data": {serialized["mime"]: serialized["content"]},
            }
            if cell_id is not None:
                result_msg["cell_id"] = cell_id
            try:
                await ws.send(json.dumps(result_msg))
            except Exception:
                logger.debug("Failed to send execute_result", exc_info=True)

        return {"status": "ok", "execution_count": self._execution_count}

    def _try_handle_magic(self, code: str) -> Optional[str]:
        """Check if *code* is a magic command and handle it.

        Currently supports:
          - ``%checkpoint ...``

        Args:
            code: Stripped code string from the cell.

        Returns:
            Output string if the code was a magic command, ``None`` otherwise.
        """
        # Only handle single-line magic commands that start with %checkpoint
        if not code.startswith("%checkpoint"):
            return None

        rest = code[len("%checkpoint"):].strip()

        if self._checkpoint_manager is None:
            return (
                "Checkpoint manager not initialised. "
                "Please restart the kernel."
            )

        return self._checkpoint_manager.handle_magic(rest)

    def interrupt(self) -> None:
        """Interrupt the currently executing code.

        Sets the interrupt event and attempts to raise KeyboardInterrupt
        in the executing thread using CPython internals.  Falls back
        gracefully on non-CPython implementations.
        """
        self._interrupt_event.set()
        thread = self._executing_thread
        if thread is not None and thread.is_alive():
            _raise_in_thread(thread.ident, KeyboardInterrupt)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class _replace_stream:
    """Context manager that temporarily replaces sys.stdout or sys.stderr."""

    def __init__(self, name: str, replacement: io.TextIOBase) -> None:
        self._name = name
        self._replacement = replacement
        self._original: Any = None

    def __enter__(self) -> "_replace_stream":
        self._original = getattr(sys, self._name)
        setattr(sys, self._name, self._replacement)
        return self

    def __exit__(self, *_: Any) -> None:
        setattr(sys, self._name, self._original)


def _raise_in_thread(tid: Optional[int], exc_type: type) -> bool:
    """Raise an exception in another thread using CPython's C API.

    This is a best-effort operation; it will silently fail on non-CPython
    implementations or if the thread id is invalid.

    Args:
        tid: The OS thread identifier (threading.Thread.ident).
        exc_type: The exception class to raise.

    Returns:
        True if the signal was delivered successfully, False otherwise.
    """
    if tid is None:
        return False
    try:
        res = ctypes.pythonapi.PyThreadState_SetAsyncExc(
            ctypes.c_ulong(tid),
            ctypes.py_object(exc_type),
        )
        if res == 0:
            logger.warning("_raise_in_thread: invalid thread id %d", tid)
            return False
        if res > 1:
            # Revert if more than one thread state was modified
            ctypes.pythonapi.PyThreadState_SetAsyncExc(ctypes.c_ulong(tid), None)
            logger.warning("_raise_in_thread: affected %d thread states, reverting", res)
            return False
        return True
    except Exception:
        logger.debug("_raise_in_thread failed", exc_info=True)
        return False


async def _send_magic_result(
    magic_result: dict, execution_count: int, ws: Any
) -> None:
    """Send a magic command result as one or more WebSocket stream messages.

    Args:
        magic_result: Dict returned by :func:`~pykernel.magic_handler.MagicHandler`
            with ``type`` and ``content`` keys.
        execution_count: Current execution count for execute_result messages.
        ws: Active WebSocket connection.
    """
    result_type = magic_result.get("type", "text")
    content = magic_result.get("content", "")

    try:
        if result_type == "display_data":
            # content is a MIME bundle dict  {"text/markdown": "...", ...}
            msg = {
                "stream": "display_data",
                "execution_count": execution_count,
                "data": content,
            }
            await ws.send(json.dumps(msg))

        elif result_type == "error":
            msg = {
                "stream": "stderr",
                "data": {"text/plain": str(content) + "\n"},
            }
            await ws.send(json.dumps(msg))

        else:
            # text result
            msg = {
                "stream": "stdout",
                "data": {"text/plain": str(content) + "\n"},
            }
            await ws.send(json.dumps(msg))
    except Exception:
        logger.debug("Failed to send magic result", exc_info=True)
