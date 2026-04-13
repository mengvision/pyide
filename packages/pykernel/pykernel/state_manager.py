"""Variable namespace inspection for PyKernel.

Provides :class:`StateManager` which reads the shared executor namespace
and returns structured metadata about Python objects without importing
optional heavy dependencies (pandas, numpy, etc.) directly.
"""

import sys
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Variables that are always present in a fresh namespace and should be
# filtered from the "user variables" listing.
_BUILTIN_NAMES = frozenset({
    "__builtins__",
    "__name__",
    "__doc__",
    "__package__",
    "__loader__",
    "__spec__",
    "__build_class__",
})


class StateManager:
    """Inspects and enumerates variables in the kernel's execution namespace.

    All inspection is done by reflection so that optional packages such as
    pandas and numpy do not need to be imported at the kernel level.

    Args:
        namespace: The ``dict`` used as globals during code execution
            (shared with :class:`~pykernel.executor.Executor`).
    """

    def __init__(self, namespace: dict) -> None:
        self._namespace = namespace

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def inspect(self, name: str) -> dict:
        """Return detailed information about a single variable.

        Args:
            name: The variable name to inspect.

        Returns:
            A dict with the following keys (some optional):

            - ``name`` (str)
            - ``type`` (str) – ``type(obj).__name__``
            - ``value_preview`` (str) – truncated ``repr``
            - ``size`` (int) – ``sys.getsizeof(obj)``
            - ``shape`` (str, optional) – for arrays / DataFrames
            - ``length`` (int, optional) – for sequences
            - ``dtype`` (str, optional) – for arrays / DataFrames
            - ``columns`` (list[str], optional) – for DataFrames

        Raises:
            KeyError: If *name* is not found in the namespace.
        """
        if name not in self._namespace:
            raise KeyError(f"Variable '{name}' not found in namespace")

        obj = self._namespace[name]
        return self._build_info(name, obj, max_preview_len=200, include_columns=True)

    def inspect_all(self) -> list:
        """List all user-defined variables in the namespace.

        Skips names that start with ``_`` and names in the built-in
        exclusion set.

        Returns:
            A list of dicts, each with the same structure as
            :meth:`inspect` but with a shorter preview (100 chars).
        """
        variables: list = []
        for name, obj in self._namespace.items():
            if name.startswith("_") or name in _BUILTIN_NAMES:
                continue
            try:
                info = self._build_info(name, obj, max_preview_len=100, include_columns=False)
                variables.append(info)
            except Exception:
                variables.append({
                    "name": name,
                    "type": type(obj).__name__,
                    "value_preview": "<error inspecting>",
                })
        return variables

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_info(
        self,
        name: str,
        obj: Any,
        *,
        max_preview_len: int = 200,
        include_columns: bool = False,
    ) -> dict:
        """Build a metadata dict for *obj*.

        Args:
            name: Variable name.
            obj: The Python object.
            max_preview_len: Maximum repr length before truncation.
            include_columns: Whether to include a ``columns`` key for
                DataFrame-like objects.

        Returns:
            Metadata dict.
        """
        info: dict = {
            "name": name,
            "type": type(obj).__name__,
            "value_preview": self._truncated_repr(obj, max_len=max_preview_len),
            "size": _safe_getsizeof(obj),
        }

        # shape (numpy ndarray, pandas DataFrame/Series, torch Tensor…)
        if hasattr(obj, "shape"):
            try:
                info["shape"] = str(obj.shape)
            except Exception:
                pass

        # length (list, tuple, dict, set, str excluded intentionally by spec)
        if hasattr(obj, "__len__") and not isinstance(obj, str):
            try:
                info["length"] = len(obj)
            except Exception:
                pass

        # dtype (numpy, pandas)
        if hasattr(obj, "dtype"):
            try:
                info["dtype"] = str(obj.dtype)
            except Exception:
                pass

        # columns (pandas DataFrame)
        if include_columns and hasattr(obj, "columns"):
            try:
                info["columns"] = [str(c) for c in list(obj.columns)[:50]]
            except Exception:
                pass

        return info

    @staticmethod
    def _truncated_repr(obj: Any, max_len: int = 200) -> str:
        """Return a truncated repr of *obj*.

        Args:
            obj: Any Python object.
            max_len: Maximum number of characters before truncation.

        Returns:
            A string representation, possibly ending with ``"..."``.
        """
        try:
            r = repr(obj)
            if len(r) > max_len:
                return r[:max_len - 3] + "..."
            return r
        except Exception:
            return f"<{type(obj).__name__}>"


# ---------------------------------------------------------------------------
# Module-level helper
# ---------------------------------------------------------------------------

def _safe_getsizeof(obj: Any) -> Optional[int]:
    """Return ``sys.getsizeof(obj)`` or ``None`` on failure."""
    try:
        return sys.getsizeof(obj)
    except Exception:
        return None
