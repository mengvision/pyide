"""Magic command handler for PyKernel.

Handles IPython-compatible magic commands:
  - Line magics  (%command args)
  - Cell magics  (%%command\\ncell_body)
  - Shell escapes (!command, !!command)

Usage
-----
::

    handler = MagicHandler(namespace, state_manager)

    # Detect and dispatch a line magic
    if MagicHandler.is_line_magic(line):
        result = handler.handle_line_magic(line)

    # Detect and dispatch a cell magic
    if MagicHandler.is_cell_magic(first_line):
        result = handler.handle_cell_magic(first_line, cell_body)

    # Detect and dispatch a shell escape
    if MagicHandler.is_shell_escape(line):
        result = handler.handle_shell_escape(line)
"""

from __future__ import annotations

import os
import platform
import re
import subprocess
import sys
import time
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_IS_WINDOWS = platform.system() == "Windows"

# Builtin / dunder names to skip in %who / %whos
_BUILTIN_NAMES = frozenset({
    "__builtins__",
    "__name__",
    "__doc__",
    "__package__",
    "__loader__",
    "__spec__",
    "__build_class__",
})


# ---------------------------------------------------------------------------
# MagicResult helpers
# ---------------------------------------------------------------------------

def _text_result(text: str) -> dict:
    """Return a plain-text magic result dict."""
    return {"type": "text", "content": text}


def _display_result(mime_bundle: dict) -> dict:
    """Return a display_data magic result dict."""
    return {"type": "display_data", "content": mime_bundle}


def _error_result(message: str) -> dict:
    """Return an error magic result dict."""
    return {"type": "error", "content": message}


# ---------------------------------------------------------------------------
# MagicHandler
# ---------------------------------------------------------------------------

class MagicHandler:
    """Parses and executes magic commands.

    Args:
        namespace: The shared execution namespace dict (same object used by
            :class:`~pykernel.executor.Executor`).
        state_manager: The :class:`~pykernel.state_manager.StateManager`
            instance (used for %who, %whos, %reset).
    """

    def __init__(self, namespace: dict, state_manager: Any) -> None:
        self._ns = namespace
        self._sm = state_manager

    # ------------------------------------------------------------------
    # Detection helpers
    # ------------------------------------------------------------------

    @staticmethod
    def is_line_magic(line: str) -> bool:
        """Return True if *line* starts with a single ``%`` (not ``%%``)."""
        stripped = line.lstrip()
        return stripped.startswith("%") and not stripped.startswith("%%")

    @staticmethod
    def is_cell_magic(first_line: str) -> bool:
        """Return True if *first_line* starts with ``%%``."""
        return first_line.lstrip().startswith("%%")

    @staticmethod
    def is_shell_escape(line: str) -> bool:
        """Return True if *line* starts with ``!`` (shell escape)."""
        stripped = line.lstrip()
        return stripped.startswith("!")

    # ------------------------------------------------------------------
    # Public dispatch
    # ------------------------------------------------------------------

    def handle_line_magic(self, line: str) -> dict:
        """Parse and execute a line magic command.

        Args:
            line: Full source line beginning with ``%``.

        Returns:
            A result dict with ``type`` and ``content`` keys.
        """
        stripped = line.lstrip()
        # Remove leading %
        body = stripped[1:]
        parts = body.split(None, 1)
        if not parts:
            return _error_result("Empty magic command.")
        name = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        dispatcher = {
            "env": self._magic_env,
            "time": self._magic_time,
            "who": self._magic_who,
            "whos": self._magic_whos,
            "reset": self._magic_reset,
            "memory": self._magic_memory,
            "ai": self._magic_ai,
            "kernel": self._magic_kernel,
            "pip": self._magic_pip,
            "pyenv": self._magic_pyenv,
            "skill": self._magic_skill,
        }
        handler = dispatcher.get(name)
        if handler is None:
            return _error_result(
                f"Unknown line magic: %{name}\n"
                "Available: %env, %time, %who, %whos, %reset, %memory, %ai, %kernel, %pip, %pyenv, %skill"
            )
        try:
            return handler(args)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Line magic %s raised", name, exc_info=True)
            return _error_result(f"%{name} error: {exc}")

    def handle_cell_magic(self, first_line: str, cell_body: str) -> dict:
        """Parse and execute a cell magic command.

        Args:
            first_line: The ``%%magic args`` first line of the cell.
            cell_body: Everything after the first line (the cell body).

        Returns:
            A result dict with ``type`` and ``content`` keys.
        """
        stripped = first_line.lstrip()
        # Remove %%
        body = stripped[2:]
        parts = body.split(None, 1)
        if not parts:
            return _error_result("Empty cell magic command.")
        name = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        dispatcher = {
            "bash": self._cell_bash,
            "time": self._cell_time,
            "markdown": self._cell_markdown,
            "sql": self._cell_sql,
            "python": self._cell_python,
        }
        handler = dispatcher.get(name)
        if handler is None:
            return _error_result(
                f"Unknown cell magic: %%{name}\n"
                "Available: %%bash, %%time, %%markdown, %%sql, %%python"
            )
        try:
            return handler(args, cell_body)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Cell magic %s raised", name, exc_info=True)
            return _error_result(f"%%{name} error: {exc}")

    def handle_shell_escape(self, line: str) -> dict:
        """Execute a shell escape (``!`` or ``!!``).

        Args:
            line: Source line starting with ``!`` or ``!!``.

        Returns:
            A result dict with ``type`` and ``content`` keys.
        """
        stripped = line.lstrip()
        capture_to_var = stripped.startswith("!!")
        command = stripped[2:].strip() if capture_to_var else stripped[1:].strip()

        if not command:
            return _error_result("Shell escape: no command specified.")

        try:
            result = subprocess.run(  # noqa: S602
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=60,
            )
            output = result.stdout
            if result.stderr:
                output = (output + result.stderr) if output else result.stderr

            if capture_to_var:
                # Store output lines as list in _ variable
                lines = result.stdout.splitlines()
                self._ns["_"] = lines
                output = (
                    f"Output captured to `_` ({len(lines)} lines)\n" + output
                )

            return _text_result(output if output else "(no output)")
        except subprocess.TimeoutExpired:
            return _error_result("Shell command timed out after 60 seconds.")
        except Exception as exc:  # noqa: BLE001
            logger.debug("Shell escape raised", exc_info=True)
            return _error_result(f"Shell escape error: {exc}")

    # ------------------------------------------------------------------
    # Line magic implementations
    # ------------------------------------------------------------------

    def _magic_env(self, args: str) -> dict:
        """``%env VAR value`` — set environment variable."""
        parts = args.split(None, 1)
        if len(parts) == 0:
            # List all env vars
            lines = [f"{k}={v}" for k, v in sorted(os.environ.items())]
            return _text_result("\n".join(lines) if lines else "(no environment variables)")
        if len(parts) == 1:
            # Get a single env var
            var = parts[0]
            val = os.environ.get(var)
            if val is None:
                return _error_result(f"%env: variable '{var}' not set.")
            return _text_result(f"{var}={val}")
        var, value = parts
        os.environ[var] = value
        self._ns[var] = value  # also put it in namespace for convenience
        return _text_result(f"env: {var} = {value}")

    def _magic_time(self, args: str) -> dict:
        """``%time statement`` — time a single statement."""
        stmt = args.strip()
        if not stmt:
            return _error_result("Usage: %time <statement>")
        try:
            start = time.perf_counter()
            exec(stmt, self._ns)  # noqa: S102
            elapsed = time.perf_counter() - start
            return _text_result(f"Wall time: {elapsed:.4f}s")
        except Exception as exc:  # noqa: BLE001
            return _error_result(f"%time execution error: {exc}")

    def _magic_who(self, args: str) -> dict:
        """``%who`` — list variable names in namespace."""
        names = _user_var_names(self._ns)
        if not names:
            return _text_result("No variables defined.")
        return _text_result("  ".join(sorted(names)))

    def _magic_whos(self, args: str) -> dict:
        """``%whos`` — detailed variable listing."""
        names = _user_var_names(self._ns)
        if not names:
            return _text_result("No variables defined.")

        rows = [("Variable", "Type", "Size", "Value")]
        for name in sorted(names):
            obj = self._ns[name]
            type_name = type(obj).__name__
            try:
                size = sys.getsizeof(obj)
                size_str = _human_bytes(size)
            except Exception:
                size_str = "?"
            try:
                preview = repr(obj)
                if len(preview) > 50:
                    preview = preview[:47] + "..."
            except Exception:
                preview = f"<{type_name}>"
            rows.append((name, type_name, size_str, preview))

        col_widths = [max(len(r[i]) for r in rows) for i in range(4)]
        lines = []
        for i, row in enumerate(rows):
            line = "  ".join(cell.ljust(col_widths[j]) for j, cell in enumerate(row))
            lines.append(line)
            if i == 0:
                lines.append("  ".join("-" * w for w in col_widths))
        return _text_result("\n".join(lines))

    def _magic_reset(self, args: str) -> dict:
        """``%reset`` — clear the user namespace."""
        force = "-f" in args or "--force" in args
        # Keep builtins, remove everything else
        keys_to_remove = [
            k for k in list(self._ns.keys())
            if k not in _BUILTIN_NAMES and not (k == "__builtins__")
        ]
        for k in keys_to_remove:
            del self._ns[k]
        return _text_result(f"Namespace cleared. ({len(keys_to_remove)} variable(s) removed)")

    def _magic_memory(self, args: str) -> dict:
        """``%memory`` — show memory usage of variables."""
        names = _user_var_names(self._ns)
        if not names:
            return _text_result("No variables defined.")

        rows: list[tuple] = []
        for name in sorted(names):
            obj = self._ns[name]
            try:
                size = sys.getsizeof(obj)
            except Exception:
                size = 0
            rows.append((name, type(obj).__name__, size))

        rows.sort(key=lambda r: r[2], reverse=True)

        header = ("Variable", "Type", "Size")
        col_data = [(r[0], r[1], _human_bytes(r[2])) for r in rows]
        all_rows = [header] + col_data
        col_widths = [max(len(str(r[i])) for r in all_rows) for i in range(3)]

        lines = []
        for i, row in enumerate(all_rows):
            line = "  ".join(str(cell).ljust(col_widths[j]) for j, cell in enumerate(row))
            lines.append(line)
            if i == 0:
                lines.append("  ".join("-" * w for w in col_widths))

        total = sum(r[2] for r in rows)
        lines.append(f"\nTotal: {_human_bytes(total)}")
        return _text_result("\n".join(lines))

    def _magic_ai(self, args: str) -> dict:
        """``%ai model_id`` — switch AI model preference."""
        model_id = args.strip()
        if not model_id:
            current = self._ns.get("__ai_model__", "(not set)")
            return _text_result(f"Current AI model: {current}\nUsage: %ai <model_id>")
        self._ns["__ai_model__"] = model_id
        return _text_result(
            f"AI model preference set to: {model_id}\n"
            "(The frontend will apply this on the next request.)"
        )

    def _magic_kernel(self, args: str) -> dict:
        """``%kernel local|remote`` — switch kernel mode hint."""
        mode = args.strip().lower()
        if mode not in ("local", "remote", ""):
            return _error_result("Usage: %kernel local|remote")
        if not mode:
            current = self._ns.get("__kernel_mode__", "(not set)")
            return _text_result(f"Current kernel mode: {current}\nUsage: %kernel local|remote")
        self._ns["__kernel_mode__"] = mode
        return _text_result(
            f"Kernel mode preference set to: {mode}\n"
            "(The frontend handles the actual kernel switch.)"
        )

    def _magic_pip(self, args: str) -> dict:
        """``%pip install/uninstall ...`` — install packages via pip."""
        cmd = args.strip()
        if not cmd:
            return _error_result("Usage: %pip install <package> [package ...]")
        try:
            result = subprocess.run(  # noqa: S603
                [sys.executable, "-m", "pip"] + cmd.split(),
                capture_output=True,
                text=True,
                timeout=120,
            )
            output = result.stdout
            if result.stderr:
                output = (output + "\n" + result.stderr).strip()
            return _text_result(output if output else "(no output)")
        except subprocess.TimeoutExpired:
            return _error_result("%pip timed out after 120 seconds.")
        except Exception as exc:  # noqa: BLE001
            return _error_result(f"%pip error: {exc}")

    def _magic_pyenv(self, args: str) -> dict:
        """``%pyenv <version>`` \u2014 switch Python version hint."""
        version = args.strip()
        if not version:
            return _error_result("Usage: %pyenv <version>  (e.g. %pyenv 3.11)")
        self._ns["__pyenv_version__"] = version
        return _text_result(
            f"Python version preference set to: {version}\n"
            "(A kernel restart is required to apply the change.)"
        )
    
    def _magic_skill(self, args: str) -> dict:
        """``%skill <subcommand> [name]`` \u2014 manage installed skills.
    
        Subcommands
        -----------
        list            List all installed skills from the lock file.
        install <name>  Install a skill. Prefix with ``clawhub:`` to signal
                        a ClawHub install (handled by the desktop app).
        remove <name>   Remove a ClawHub-installed skill.
        update <name>   Re-install/update a ClawHub skill to the latest version.
        """
        parts = args.split()
        if not parts:
            return _text_result(
                "Usage: %skill <subcommand> [name]\n"
                "Subcommands: list, install <name>, remove <name>, update <name>\n"
                "\nExample (ClawHub): %skill install clawhub:pandas-helper"
            )
    
        subcmd = parts[0].lower()
    
        if subcmd == "list":
            return self._skill_list()
    
        if subcmd == "install":
            if len(parts) < 2:
                return _error_result("Usage: %skill install <name>  (prefix clawhub: for registry)")
            name = parts[1]
            return self._skill_install(name)
    
        if subcmd in ("remove", "uninstall"):
            if len(parts) < 2:
                return _error_result("Usage: %skill remove <name>")
            return _text_result(
                f"Removing skill '{parts[1]}'...\n"
                "Note: Skill removal is handled by the desktop app's Skills panel."
            )
    
        if subcmd == "update":
            if len(parts) < 2:
                return _error_result("Usage: %skill update <name>")
            name = parts[1]
            return _text_result(
                f"Updating skill '{name}'...\n"
                "Note: Skill updates are handled by the desktop app's Skills panel (ClawHub button)."
            )
    
        return _error_result(
            f"Unknown %skill subcommand: '{subcmd}'\n"
            "Available: list, install, remove, update"
        )
    
    # ------ skill helpers ------
    
    def _skill_list(self) -> dict:
        """Read the skill lock file and return installed skill info."""
        import json
        import os
        home = os.path.expanduser("~")
        lock_path = os.path.join(home, ".pyide", ".skill-lock.json")
        try:
            with open(lock_path, encoding="utf-8") as fh:
                data = json.load(fh)
            skills = data.get("skills", [])
            if not skills:
                return _text_result("No skills installed via ClawHub yet.")
            lines = [f"{'Name':<24} {'Version':<10} {'Source':<10} Installed at"]
            lines.append("-" * 64)
            for s in skills:
                lines.append(
                    f"{s.get('name','?'):<24} "
                    f"{s.get('version','?'):<10} "
                    f"{s.get('source','?'):<10} "
                    f"{s.get('installed_at','?')[:10]}"
                )
            return _text_result("\n".join(lines))
        except FileNotFoundError:
            return _text_result("No .skill-lock.json found. No skills installed yet.")
        except Exception as exc:
            return _error_result(f"Could not read skill lock file: {exc}")
    
    def _skill_install(self, name: str) -> dict:
        """Handle %skill install <name>."""
        if name.startswith("clawhub:"):
            skill_name = name[8:].strip()
            if not skill_name:
                return _error_result("Usage: %skill install clawhub:<skill-name>")
            return _text_result(
                f"ClawHub install requested: '{skill_name}'\n"
                "\nTo install, open the Skills panel in the sidebar and click \"\ud83d\udc3e ClawHub\","
                " then search for and install the skill from the marketplace."
            )
        # Generic install from a local path or other source
        return _text_result(
            f"Installing skill from: {name}\n"
            "Note: Local skill installation requires placing a SKILL.md file in:\n"
            f"  ~/.pyide/skills/user/{name}/SKILL.md"
        )

    # ------------------------------------------------------------------
    # Cell magic implementations
    # ------------------------------------------------------------------

    def _cell_bash(self, args: str, body: str) -> dict:
        """``%%bash`` — execute cell as shell script."""
        if not body.strip():
            return _text_result("(empty script)")

        if _IS_WINDOWS:
            # On Windows use cmd /c or PowerShell
            shell_cmd = ["powershell", "-NoProfile", "-Command", body]
            try:
                result = subprocess.run(  # noqa: S603
                    shell_cmd,
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
            except FileNotFoundError:
                # Fallback to cmd
                result = subprocess.run(  # noqa: S603
                    ["cmd", "/c", body],
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
        else:
            result = subprocess.run(  # noqa: S603
                body,
                shell=True,
                executable="/bin/bash",
                capture_output=True,
                text=True,
                timeout=120,
            )

        output = result.stdout
        if result.stderr:
            output = (output + result.stderr) if output else result.stderr
        return _text_result(output if output else "(no output)")

    def _cell_time(self, args: str, body: str) -> dict:
        """``%%time`` — time entire cell execution."""
        if not body.strip():
            return _text_result("Wall time: 0.0000s")
        try:
            start = time.perf_counter()
            exec(body, self._ns)  # noqa: S102
            elapsed = time.perf_counter() - start
            return _text_result(f"Wall time: {elapsed:.4f}s")
        except Exception as exc:  # noqa: BLE001
            return _error_result(f"%%time execution error: {exc}")

    def _cell_markdown(self, args: str, body: str) -> dict:
        """``%%markdown`` — render cell as markdown."""
        return _display_result({"text/markdown": body})

    def _cell_sql(self, args: str, body: str) -> dict:
        """``%%sql`` — execute SQL against the sql_engine (if available)."""
        try:
            from . import sql_engine as _sql  # type: ignore[import]
            return _sql.execute(body.strip(), args.strip(), namespace=self._ns)
        except ImportError:
            pass

        # sql_engine not available — give a helpful error with instructions
        return _error_result(
            "%%sql: SQL engine not available.\n"
            "To enable SQL support, ensure `sql_engine.py` exists in the pykernel package\n"
            "and that a database connection is configured.\n\n"
            "Quick start:\n"
            "  %pip install duckdb pandas\n"
            "  # Then %%sql will use an in-memory DuckDB database by default."
        )

    def _cell_python(self, args: str, body: str) -> dict:
        """``%%python`` — explicit Python cell (default behaviour, no-op magic)."""
        # Return a sentinel so the caller knows to exec the body normally
        return {"type": "exec_body", "content": body}


# ---------------------------------------------------------------------------
# Pre-execution transformer
# ---------------------------------------------------------------------------

def transform_code(code: str, namespace: dict, state_manager: Any) -> tuple[Optional[str], Optional[dict]]:
    """Pre-process *code* for magic commands and shell escapes.

    This is called by the executor *before* passing code to ``exec``.
    If the entire input is a magic command / shell escape, returns
    ``(None, result_dict)``.  Otherwise returns the (possibly transformed)
    code and ``None``.

    Args:
        code: Raw source code from the cell.
        namespace: The execution namespace.
        state_manager: The StateManager instance.

    Returns:
        ``(transformed_code, None)`` if code should still be executed,
        or ``(None, result_dict)`` if the magic handled everything.
    """
    handler = MagicHandler(namespace, state_manager)
    lines = code.split("\n")
    first_line = lines[0].rstrip() if lines else ""

    # --- Cell magic (%%command) ---
    if MagicHandler.is_cell_magic(first_line):
        body = "\n".join(lines[1:])
        result = handler.handle_cell_magic(first_line, body)
        if result.get("type") == "exec_body":
            # %%python: just run the body as normal Python
            return result["content"], None
        return None, result

    # --- Single-line magic (%command) ---
    if len(lines) == 1 and MagicHandler.is_line_magic(first_line):
        result = handler.handle_line_magic(first_line)
        return None, result

    # --- Shell escape on a single line ---
    if len(lines) == 1 and MagicHandler.is_shell_escape(first_line):
        result = handler.handle_shell_escape(first_line)
        return None, result

    # --- Multi-line: transform line-by-line for ! escapes ---
    # (magic lines inside multi-line cells are not supported — IPython doesn't
    #  either; they would cause SyntaxError if left as-is)
    return code, None


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _user_var_names(namespace: dict) -> list[str]:
    """Return names of user-defined variables in *namespace*."""
    return [
        k for k in namespace
        if not k.startswith("_") and k not in _BUILTIN_NAMES
    ]


def _human_bytes(size: int) -> str:
    """Format *size* bytes as a human-readable string."""
    if size < 1024:
        return f"{size} B"
    if size < 1024 ** 2:
        return f"{size / 1024:.1f} KB"
    if size < 1024 ** 3:
        return f"{size / 1024 ** 2:.1f} MB"
    return f"{size / 1024 ** 3:.1f} GB"
