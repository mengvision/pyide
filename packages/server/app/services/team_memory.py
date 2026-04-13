"""
Team Memory Service
===================
Stores shared team memories as Markdown files with YAML frontmatter,
consistent with the local memory format used by the desktop client.

Storage layout:
  {PYIDE_DATA_DIR}/team/memory/<uuid>.md

Each file looks like:
  ---
  id: <uuid>
  author: <username>
  author_id: <user_id>
  permission: public | department | sensitive
  category: best-practices
  tags:
    - python
    - typing
  created_at: 2026-04-07T10:00:00
  updated_at: 2026-04-07T10:00:00
  ---

  <memory content in markdown>
"""

import uuid
import yaml
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, status


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class TeamMemoryService:
    def __init__(self, data_dir: str):
        self.memory_dir = Path(data_dir) / "team" / "memory"
        self.memory_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _file_path(self, memory_id: str) -> Path:
        return self.memory_dir / f"{memory_id}.md"

    def _serialize(self, meta: dict, content: str) -> str:
        """Serialize a memory to Markdown + YAML frontmatter."""
        frontmatter = yaml.dump(meta, default_flow_style=False, allow_unicode=True)
        return f"---\n{frontmatter}---\n\n{content}"

    def _parse(self, filepath: Path) -> dict:
        """Parse a memory file; returns merged dict with 'content' key."""
        text = filepath.read_text(encoding="utf-8")
        if text.startswith("---"):
            parts = text.split("---", 2)
            if len(parts) >= 3:
                meta = yaml.safe_load(parts[1]) or {}
                content = parts[2].strip()
                return {**meta, "content": content}
        # Fallback: treat entire file as content
        return {"content": text, "id": filepath.stem}

    def _to_response(self, data: dict) -> dict:
        """Normalise a parsed memory dict to the API response shape."""
        return {
            "id": data.get("id", ""),
            "content": data.get("content", ""),
            "author": data.get("author", ""),
            "tags": data.get("tags") or [],
            "permission": data.get("permission", "public"),
            "category": data.get("category"),
            "created_at": data.get("created_at", ""),
            "updated_at": data.get("updated_at", ""),
        }

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    async def create(self, user_id: int, username: str, request) -> dict:
        """Create a new team memory entry."""
        memory_id = str(uuid.uuid4())
        now = _now_iso()

        meta = {
            "id": memory_id,
            "author": username,
            "author_id": user_id,
            "permission": request.permission.value if hasattr(request.permission, "value") else str(request.permission),
            "category": request.category,
            "tags": request.tags or [],
            "created_at": now,
            "updated_at": now,
        }

        filepath = self._file_path(memory_id)
        filepath.write_text(self._serialize(meta, request.content), encoding="utf-8")

        return self._to_response({**meta, "content": request.content})

    async def get(self, memory_id: str) -> dict:
        """Retrieve a single memory entry by ID."""
        filepath = self._file_path(memory_id)
        if not filepath.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
        return self._to_response(self._parse(filepath))

    async def list_all(
        self,
        *,
        permission_filter: Optional[str] = None,
        category_filter: Optional[str] = None,
        is_admin: bool = False,
    ) -> List[dict]:
        """List all accessible team memories.

        Non-admin users cannot see 'sensitive' memories.
        """
        results = []
        for md_file in sorted(self.memory_dir.glob("*.md"), key=lambda f: f.stat().st_mtime, reverse=True):
            try:
                data = self._parse(md_file)
            except Exception:
                continue

            perm = data.get("permission", "public")

            # Permission gate: sensitive → admin only
            if perm == "sensitive" and not is_admin:
                continue

            # Optional query filters
            if permission_filter and perm != permission_filter:
                continue
            if category_filter and data.get("category") != category_filter:
                continue

            results.append(self._to_response(data))

        return results

    async def update(
        self,
        memory_id: str,
        user_id: int,
        username: str,
        request,
        is_admin: bool = False,
    ) -> dict:
        """Update a memory entry. Only the original author or an admin may edit."""
        filepath = self._file_path(memory_id)
        if not filepath.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

        data = self._parse(filepath)

        # Authorisation check
        if data.get("author_id") != user_id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the author or an admin can update this memory",
            )

        # Apply partial updates
        if request.content is not None:
            content = request.content
        else:
            content = data["content"]

        if request.tags is not None:
            data["tags"] = request.tags
        if request.permission is not None:
            data["permission"] = (
                request.permission.value if hasattr(request.permission, "value") else str(request.permission)
            )
        if request.category is not None:
            data["category"] = request.category

        data["updated_at"] = _now_iso()

        # Re-serialise without the 'content' key in frontmatter
        meta = {k: v for k, v in data.items() if k != "content"}
        filepath.write_text(self._serialize(meta, content), encoding="utf-8")

        return self._to_response({**data, "content": content})

    async def delete(self, memory_id: str, user_id: int, is_admin: bool = False) -> bool:
        """Delete a memory entry. Only the original author or an admin may delete."""
        filepath = self._file_path(memory_id)
        if not filepath.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")

        data = self._parse(filepath)

        if data.get("author_id") != user_id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the author or an admin can delete this memory",
            )

        filepath.unlink()
        return True

    async def search(self, query: str, is_admin: bool = False) -> List[dict]:
        """Simple case-insensitive keyword search across all accessible memories."""
        query_lower = query.lower()
        results = []

        for md_file in self.memory_dir.glob("*.md"):
            try:
                data = self._parse(md_file)
            except Exception:
                continue

            perm = data.get("permission", "public")
            if perm == "sensitive" and not is_admin:
                continue

            # Search in content, category, and tags
            searchable = " ".join(
                filter(
                    None,
                    [
                        data.get("content", ""),
                        data.get("category", ""),
                        " ".join(data.get("tags") or []),
                    ],
                )
            ).lower()

            if query_lower in searchable:
                results.append(self._to_response(data))

        return results


# ---------------------------------------------------------------------------
# Singleton-style factory — lazily created and reused per data_dir
# ---------------------------------------------------------------------------
_service_instance: Optional[TeamMemoryService] = None


def get_team_memory_service(data_dir: str) -> TeamMemoryService:
    global _service_instance
    if _service_instance is None:
        _service_instance = TeamMemoryService(data_dir)
    return _service_instance
