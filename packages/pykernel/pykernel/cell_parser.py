"""Cell parser for PyKernel.

Parses Python file content into logical "cells" delimited by ``# %%``
markers (VS Code / Jupyter-compatible format).
"""

import re
from typing import Optional

# Pattern matches lines like:
#   # %%
#   # %% [My Title]
#   #%%
#   #%% [My Title]
_CELL_PATTERN = re.compile(r"^#\s*%%\s*(?:\[(.+?)\])?\s*$")


def parse_cells(content: str) -> list:
    """Parse file content into cells delimited by ``# %%`` markers.

    Each cell is represented as a dict with the following keys:

    - ``index`` (int) – zero-based cell index
    - ``title`` (str) – title from ``# %% [title]`` or auto-generated
    - ``start_line`` (int) – 0-based line index of the ``# %%`` marker
    - ``end_line`` (int) – 0-based inclusive line index of the last line
    - ``code`` (str) – full source text of the cell including the marker line

    If no ``# %%`` markers are found and the content is non-empty, the
    entire file is treated as a single unnamed cell.

    Args:
        content: Full source text of a Python file.

    Returns:
        A list of cell dicts (may be empty if *content* is blank).

    Examples:
        >>> cells = parse_cells("# %%\\nx = 1\\n# %% [Second]\\ny = 2")
        >>> len(cells)
        2
        >>> cells[0]["title"]
        'Cell 1'
        >>> cells[1]["title"]
        'Second'
    """
    if not content:
        return []

    lines = content.split("\n")
    cells: list = []
    current_cell: Optional[dict] = None

    for i, line in enumerate(lines):
        match = _CELL_PATTERN.match(line)
        if match:
            # Finalise the previous cell
            if current_cell is not None:
                current_cell["end_line"] = i - 1
                current_cell["code"] = "\n".join(
                    lines[current_cell["start_line"]:i]
                )
                cells.append(current_cell)

            title_group = match.group(1)
            title = title_group.strip() if title_group else f"Cell {len(cells) + 1}"
            current_cell = {
                "index": len(cells),
                "title": title,
                "start_line": i,
                "end_line": None,
                "code": "",
            }

    # Finalise the last cell
    if current_cell is not None:
        current_cell["end_line"] = len(lines) - 1
        current_cell["code"] = "\n".join(lines[current_cell["start_line"]:])
        cells.append(current_cell)

    # No markers found: treat whole file as one cell
    if not cells and content.strip():
        cells.append({
            "index": 0,
            "title": "Cell 1",
            "start_line": 0,
            "end_line": len(lines) - 1,
            "code": content,
        })

    return cells


def get_cell_at_line(cells: list, line: int) -> Optional[dict]:
    """Return the cell that contains the given line number.

    Args:
        cells: List returned by :func:`parse_cells`.
        line: 0-based line number to look up.

    Returns:
        The matching cell dict, or ``None`` if not found.
    """
    for cell in cells:
        if cell["start_line"] <= line <= cell["end_line"]:
            return cell
    return None
