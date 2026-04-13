"""3-layer checkpoint system for PyKernel state persistence.

Layer 1 - Hot State:  auto-saves variable metadata (names/types/sizes)
                      to a temp directory every 60 seconds.
Layer 2 - Session Checkpoint: full namespace serialisation via ``dill``
                               stored in ``~/.pyide/checkpoints/``.
Layer 3 - Project Snapshot:   checkpoint + descriptive metadata stored
                               in ``~/.pyide/snapshots/``.
"""

import json
import logging
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class CheckpointManager:
    """3-layer checkpoint system for PyKernel state persistence.

    Args:
        namespace: The shared execution namespace dict (same object used by
            :class:`~pykernel.executor.Executor`).
        session_id: Optional session identifier used to name the hot-state
            temp directory.  Auto-generated from the current timestamp when
            not supplied.
    """

    def __init__(self, namespace: dict, session_id: Optional[str] = None) -> None:
        self._namespace = namespace
        self.session_id = session_id or f"session_{int(time.time())}"
        self._auto_save_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._setup_directories()

    # ------------------------------------------------------------------
    # Directory setup
    # ------------------------------------------------------------------

    def _setup_directories(self) -> None:
        """Create checkpoint and snapshot directories if they do not exist."""
        # Layer 1: Hot state in OS temp dir (cross-platform, no /tmp hardcode)
        tmp = Path(tempfile.gettempdir())
        self.hot_dir = tmp / f"pyide-{self.session_id}"
        self.hot_dir.mkdir(parents=True, exist_ok=True)

        home = Path.home()

        # Layer 2: Session checkpoints
        self.checkpoint_dir = home / ".pyide" / "checkpoints"
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)

        # Layer 3: Project snapshots
        self.snapshot_dir = home / ".pyide" / "snapshots"
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Layer 1: Hot State (metadata only, no serialisation of values)
    # ------------------------------------------------------------------

    def save_hot_state(self) -> None:
        """Auto-save variable metadata (names, types, sizes) to temp dir.

        This is cheap — it only records ``type(v).__name__`` and
        ``sys.getsizeof(v)`` for each user variable; actual values are
        *not* serialised.
        """
        metadata: Dict[str, Any] = {}
        for name, value in self._namespace.items():
            if name.startswith("_"):
                continue
            try:
                metadata[name] = {
                    "type": type(value).__name__,
                    "size": _safe_getsizeof(value),
                }
            except Exception:
                pass

        hot_path = self.hot_dir / "hot-state.json"
        try:
            hot_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        except Exception:
            logger.debug("Failed to write hot state", exc_info=True)

    def start_auto_save(self, interval: int = 60) -> None:
        """Start a background daemon thread that calls :meth:`save_hot_state`.

        Args:
            interval: Seconds between saves (default 60).
        """
        if self._auto_save_thread is not None and self._auto_save_thread.is_alive():
            return  # already running

        self._stop_event.clear()

        def _loop() -> None:
            while not self._stop_event.wait(interval):
                try:
                    self.save_hot_state()
                except Exception:
                    logger.debug("Auto-save hot state failed", exc_info=True)

        self._auto_save_thread = threading.Thread(
            target=_loop, daemon=True, name="pykernel-checkpoint-autosave"
        )
        self._auto_save_thread.start()
        logger.info("Checkpoint auto-save started (interval=%ds)", interval)

    def stop_auto_save(self) -> None:
        """Stop the background auto-save thread."""
        self._stop_event.set()

    # ------------------------------------------------------------------
    # Layer 2: Session Checkpoint (full dill serialisation)
    # ------------------------------------------------------------------

    def save_checkpoint(self, name: Optional[str] = None) -> str:
        """Serialise the current namespace using ``dill`` and save to disk.

        Skips variables that cannot be pickled and reports them in the
        return string.

        Args:
            name: Human-readable checkpoint name.  Auto-generated from the
                current Unix timestamp when not supplied.

        Returns:
            A human-readable status string.
        """
        try:
            import dill  # type: ignore[import]
        except ImportError:
            return (
                "Error: 'dill' is not installed. "
                "Install it with: pip install dill"
            )

        timestamp = int(time.time())
        checkpoint_name = name or f"checkpoint_{timestamp}"
        checkpoint_path = self.checkpoint_dir / f"{checkpoint_name}.pkl"
        meta_path = self.checkpoint_dir / f"{checkpoint_name}.json"

        serializable: dict = {}
        failed: List[str] = []

        for k, v in self._namespace.items():
            if k.startswith("_"):
                continue
            try:
                dill.dumps(v)
                serializable[k] = v
            except Exception:
                failed.append(k)

        try:
            with open(checkpoint_path, "wb") as fh:
                dill.dump(serializable, fh)
        except Exception as exc:
            return f"Error: Failed to write checkpoint file: {exc}"

        size_bytes = checkpoint_path.stat().st_size
        meta: Dict[str, Any] = {
            "name": checkpoint_name,
            "timestamp": timestamp,
            "variables": list(serializable.keys()),
            "failed": failed,
            "size_bytes": size_bytes,
        }
        try:
            meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception:
            logger.debug("Failed to write checkpoint metadata", exc_info=True)

        result = f"Checkpoint '{checkpoint_name}' saved ({len(serializable)} variables"
        if failed:
            result += f", {len(failed)} skipped: {', '.join(failed)}"
        result += f", {size_bytes / 1024:.1f} KB)"
        return result

    def restore_checkpoint(
        self,
        name: str,
        variables: Optional[List[str]] = None,
    ) -> str:
        """Restore variables from a saved checkpoint.

        Args:
            name: Checkpoint name (without ``.pkl`` extension).
            variables: If given, only restore these named variables.
                       If ``None``, restore the full namespace.

        Returns:
            A human-readable status string.
        """
        try:
            import dill  # type: ignore[import]
        except ImportError:
            return (
                "Error: 'dill' is not installed. "
                "Install it with: pip install dill"
            )

        checkpoint_path = self.checkpoint_dir / f"{name}.pkl"
        if not checkpoint_path.exists():
            # Try snapshot checkpoints directory too
            checkpoint_path = self.snapshot_dir / f"{name}.pkl"
            if not checkpoint_path.exists():
                return f"Error: Checkpoint '{name}' not found."

        try:
            with open(checkpoint_path, "rb") as fh:
                saved_namespace: dict = dill.load(fh)
        except Exception as exc:
            return f"Error: Failed to load checkpoint '{name}': {exc}"

        if variables:
            restored: List[str] = []
            missing: List[str] = []
            for var in variables:
                if var in saved_namespace:
                    self._namespace[var] = saved_namespace[var]
                    restored.append(var)
                else:
                    missing.append(var)
            msg = f"Restored {len(restored)} variables: {', '.join(restored)}"
            if missing:
                msg += f" (not found: {', '.join(missing)})"
            return msg
        else:
            count = 0
            for k, v in saved_namespace.items():
                self._namespace[k] = v
                count += 1
            return f"Restored {count} variables from '{name}'"

    def list_checkpoints(self) -> str:
        """Return a formatted listing of all saved checkpoints.

        Returns:
            Multi-line string listing checkpoint names, timestamps, and sizes.
        """
        checkpoints: List[dict] = []
        for meta_file in sorted(self.checkpoint_dir.glob("*.json")):
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                checkpoints.append(meta)
            except Exception:
                pass

        if not checkpoints:
            return "No checkpoints found."

        lines = ["Available checkpoints:"]
        for cp in checkpoints:
            ts = time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime(cp.get("timestamp", 0))
            )
            size_kb = cp.get("size_bytes", 0) / 1024
            n_vars = len(cp.get("variables", []))
            lines.append(
                f"  {cp['name']}  ({ts}, {n_vars} vars, {size_kb:.1f} KB)"
            )
        return "\n".join(lines)

    def delete_checkpoint(self, name: str) -> str:
        """Delete a checkpoint by name.

        Args:
            name: Checkpoint name (without extension).

        Returns:
            A human-readable status string.
        """
        pkl = self.checkpoint_dir / f"{name}.pkl"
        meta = self.checkpoint_dir / f"{name}.json"
        deleted = []
        for path in (pkl, meta):
            if path.exists():
                try:
                    path.unlink()
                    deleted.append(path.name)
                except Exception as exc:
                    return f"Error: Could not delete '{path.name}': {exc}"
        if deleted:
            return f"Deleted checkpoint '{name}'."
        return f"Error: Checkpoint '{name}' not found."

    # ------------------------------------------------------------------
    # Layer 3: Project Snapshot
    # ------------------------------------------------------------------

    def save_snapshot(self, description: str = "") -> str:
        """Save a named project snapshot (checkpoint + descriptive metadata).

        A snapshot is essentially a Layer 2 checkpoint whose metadata
        includes a free-text description suitable for long-term storage.

        Args:
            description: Optional human-readable description of this snapshot.

        Returns:
            A human-readable status string.
        """
        snapshot_name = f"snapshot_{int(time.time())}"

        # Reuse the checkpoint mechanism — store in checkpoint_dir
        checkpoint_result = self.save_checkpoint(snapshot_name)
        if checkpoint_result.startswith("Error"):
            return checkpoint_result

        # Write snapshot-specific metadata
        snap_meta: Dict[str, Any] = {
            "name": snapshot_name,
            "description": description,
            "timestamp": int(time.time()),
            "checkpoint": snapshot_name,
            "checkpoint_result": checkpoint_result,
        }
        snap_path = self.snapshot_dir / f"{snapshot_name}.json"
        try:
            snap_path.write_text(json.dumps(snap_meta, indent=2), encoding="utf-8")
        except Exception:
            logger.debug("Failed to write snapshot metadata", exc_info=True)

        return f"Snapshot '{snapshot_name}' saved: {description or '(no description)'}"

    def list_snapshots(self) -> str:
        """Return a formatted listing of all saved snapshots.

        Returns:
            Multi-line string listing snapshot names, descriptions, and timestamps.
        """
        snapshots: List[dict] = []
        for meta_file in sorted(self.snapshot_dir.glob("*.json")):
            try:
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                snapshots.append(meta)
            except Exception:
                pass

        if not snapshots:
            return "No snapshots found."

        lines = ["Available snapshots:"]
        for snap in snapshots:
            ts = time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime(snap.get("timestamp", 0))
            )
            desc = snap.get("description") or "(no description)"
            lines.append(f"  {snap['name']}  ({ts}) — {desc}")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Magic command dispatcher
    # ------------------------------------------------------------------

    def handle_magic(self, line: str) -> Optional[str]:
        """Parse and handle a ``%checkpoint`` magic command line.

        Recognised forms::

            %checkpoint save [name]
            %checkpoint restore <name> [var1 var2 ...]
            %checkpoint list
            %checkpoint delete <name>
            %checkpoint snapshot [description ...]
            %checkpoint snapshots

        Args:
            line: The full magic line *without* the leading ``%checkpoint``.

        Returns:
            Result string, or ``None`` if the line is not a checkpoint magic.
        """
        parts = line.strip().split()
        if not parts:
            return self._checkpoint_help()

        sub = parts[0].lower()

        if sub == "save":
            name = parts[1] if len(parts) > 1 else None
            return self.save_checkpoint(name)

        if sub == "restore":
            if len(parts) < 2:
                return "Usage: %checkpoint restore <name> [var1 var2 ...]"
            name = parts[1]
            variables = parts[2:] if len(parts) > 2 else None
            return self.restore_checkpoint(name, variables)

        if sub == "list":
            return self.list_checkpoints()

        if sub == "delete":
            if len(parts) < 2:
                return "Usage: %checkpoint delete <name>"
            return self.delete_checkpoint(parts[1])

        if sub == "snapshot":
            description = " ".join(parts[1:]) if len(parts) > 1 else ""
            return self.save_snapshot(description)

        if sub == "snapshots":
            return self.list_snapshots()

        return self._checkpoint_help()

    @staticmethod
    def _checkpoint_help() -> str:
        return (
            "Usage: %checkpoint <subcommand> [args]\n"
            "  save [name]                     — save current namespace\n"
            "  restore <name> [var1 var2 ...]  — restore from checkpoint\n"
            "  list                            — list saved checkpoints\n"
            "  delete <name>                   — delete a checkpoint\n"
            "  snapshot [description]          — save a project snapshot\n"
            "  snapshots                       — list saved snapshots"
        )


# ---------------------------------------------------------------------------
# Module-level helper
# ---------------------------------------------------------------------------

def _safe_getsizeof(obj: Any) -> Optional[int]:
    """Return ``sys.getsizeof(obj)`` or ``None`` on failure."""
    try:
        return sys.getsizeof(obj)
    except Exception:
        return None
