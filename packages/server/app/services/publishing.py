"""File-system backed service for code publishing.

Storage layout (under PYIDE_DATA_DIR/shared/published/):
  <pub_id>/
    current_version   ← plain text file: "3"
    v1/
      metadata.json   ← full metadata for this version
      source.py       ← source code
      outputs.json    ← (optional) cell outputs
    v2/
      ...

The publication ID is a short UUID (8 hex chars).
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from ..models.publishing import PublishRequest, Visibility


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class PublishingService:
    def __init__(self, data_dir: str) -> None:
        self.publish_dir = Path(data_dir) / "shared" / "published"
        self.publish_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _pub_path(self, pub_id: str) -> Path:
        return self.publish_dir / pub_id

    def _current_version(self, pub_id: str) -> int:
        cv_file = self._pub_path(pub_id) / "current_version"
        if not cv_file.exists():
            return 0
        return int(cv_file.read_text().strip())

    def _version_path(self, pub_id: str, version: int) -> Path:
        return self._pub_path(pub_id) / f"v{version}"

    def _read_metadata(self, pub_id: str, version: int) -> Optional[dict]:
        meta_file = self._version_path(pub_id, version) / "metadata.json"
        if not meta_file.exists():
            return None
        return json.loads(meta_file.read_text())

    def _all_versions(self, pub_id: str) -> List[int]:
        pub_path = self._pub_path(pub_id)
        if not pub_path.exists():
            return []
        versions = []
        for child in pub_path.iterdir():
            if child.is_dir() and child.name.startswith("v"):
                try:
                    versions.append(int(child.name[1:]))
                except ValueError:
                    pass
        return sorted(versions)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def create(
        self, user_id: int, username: str, request: PublishRequest
    ) -> dict:
        """Create a brand-new published script (version 1)."""
        pub_id = str(uuid.uuid4()).replace("-", "")[:8]
        version = 1
        now = _utcnow()

        pub_path = self._pub_path(pub_id)
        version_path = self._version_path(pub_id, version)
        version_path.mkdir(parents=True, exist_ok=True)

        metadata = {
            "id": pub_id,
            "title": request.title,
            "description": request.description,
            "author": username,
            "author_id": user_id,
            "visibility": request.visibility.value,
            "version": version,
            "tags": request.tags or [],
            "environment": request.environment,
            "created_at": now,
            "updated_at": now,
        }

        (version_path / "metadata.json").write_text(
            json.dumps(metadata, indent=2), encoding="utf-8"
        )
        (version_path / "source.py").write_text(
            request.source_code, encoding="utf-8"
        )
        if request.outputs:
            (version_path / "outputs.json").write_text(
                json.dumps(request.outputs, indent=2), encoding="utf-8"
            )

        (pub_path / "current_version").write_text(str(version), encoding="utf-8")
        return metadata

    async def add_version(
        self, pub_id: str, user_id: int, username: str, request: PublishRequest
    ) -> dict:
        """Add a new version to an existing publication."""
        pub_path = self._pub_path(pub_id)
        if not pub_path.exists():
            raise FileNotFoundError(f"Publication '{pub_id}' not found")

        # Ownership check: read any existing version metadata
        current_ver = self._current_version(pub_id)
        existing_meta = self._read_metadata(pub_id, current_ver)
        if existing_meta and existing_meta.get("author_id") != user_id:
            raise PermissionError("Only the author can publish new versions")

        version = current_ver + 1
        version_path = self._version_path(pub_id, version)
        version_path.mkdir(parents=True, exist_ok=True)
        now = _utcnow()

        # Preserve original created_at from version 1
        original_meta = self._read_metadata(pub_id, 1)
        created_at = original_meta["created_at"] if original_meta else now

        metadata = {
            "id": pub_id,
            "title": request.title,
            "description": request.description,
            "author": username,
            "author_id": user_id,
            "visibility": request.visibility.value,
            "version": version,
            "tags": request.tags or [],
            "environment": request.environment,
            "created_at": created_at,
            "updated_at": now,
        }

        (version_path / "metadata.json").write_text(
            json.dumps(metadata, indent=2), encoding="utf-8"
        )
        (version_path / "source.py").write_text(
            request.source_code, encoding="utf-8"
        )
        if request.outputs:
            (version_path / "outputs.json").write_text(
                json.dumps(request.outputs, indent=2), encoding="utf-8"
            )

        (pub_path / "current_version").write_text(str(version), encoding="utf-8")
        return metadata

    async def get(
        self,
        pub_id: str,
        version: Optional[int] = None,
        requesting_user_id: Optional[int] = None,
        is_authenticated: bool = False,
    ) -> dict:
        """Retrieve a publication.

        Visibility enforcement:
          - private  → only the author
          - team     → any authenticated user
          - public   → anyone
        """
        pub_path = self._pub_path(pub_id)
        if not pub_path.exists():
            raise FileNotFoundError(f"Publication '{pub_id}' not found")

        current_ver = self._current_version(pub_id)
        if current_ver == 0:
            raise FileNotFoundError(f"Publication '{pub_id}' has no versions")

        target_ver = version if version else current_ver
        meta = self._read_metadata(pub_id, target_ver)
        if meta is None:
            raise FileNotFoundError(
                f"Version {target_ver} of publication '{pub_id}' not found"
            )

        # Visibility enforcement
        vis = meta.get("visibility", "public")
        if vis == Visibility.PRIVATE.value:
            if meta.get("author_id") != requesting_user_id:
                raise PermissionError("This publication is private")
        elif vis == Visibility.TEAM.value:
            if not is_authenticated:
                raise PermissionError(
                    "Authentication required to view team publications"
                )

        source_file = self._version_path(pub_id, target_ver) / "source.py"
        outputs_file = self._version_path(pub_id, target_ver) / "outputs.json"

        source_code = (
            source_file.read_text(encoding="utf-8") if source_file.exists() else ""
        )
        outputs = None
        if outputs_file.exists():
            outputs = json.loads(outputs_file.read_text(encoding="utf-8"))

        all_versions = self._all_versions(pub_id)

        return {
            **meta,
            "source_code": source_code,
            "outputs": outputs,
            "versions": all_versions,
        }

    async def list_by_user(self, user_id: int) -> List[dict]:
        """List all publications authored by the given user."""
        results = []
        if not self.publish_dir.exists():
            return results
        for pub_path in self.publish_dir.iterdir():
            if not pub_path.is_dir():
                continue
            current_ver = self._current_version(pub_path.name)
            if current_ver == 0:
                continue
            meta = self._read_metadata(pub_path.name, current_ver)
            if meta and meta.get("author_id") == user_id:
                results.append(meta)
        results.sort(key=lambda m: m.get("updated_at", ""), reverse=True)
        return results

    async def list_public(self) -> List[dict]:
        """List all publications with visibility 'public' or 'team'."""
        results = []
        if not self.publish_dir.exists():
            return results
        for pub_path in self.publish_dir.iterdir():
            if not pub_path.is_dir():
                continue
            current_ver = self._current_version(pub_path.name)
            if current_ver == 0:
                continue
            meta = self._read_metadata(pub_path.name, current_ver)
            if meta and meta.get("visibility") in (
                Visibility.PUBLIC.value,
                Visibility.TEAM.value,
            ):
                results.append(meta)
        results.sort(key=lambda m: m.get("updated_at", ""), reverse=True)
        return results

    async def delete(self, pub_id: str, user_id: int, is_admin: bool = False) -> None:
        """Delete an entire publication (all versions).

        Only the author or an admin may delete.
        """
        pub_path = self._pub_path(pub_id)
        if not pub_path.exists():
            raise FileNotFoundError(f"Publication '{pub_id}' not found")

        current_ver = self._current_version(pub_id)
        if current_ver > 0:
            meta = self._read_metadata(pub_id, current_ver)
            if meta and meta.get("author_id") != user_id and not is_admin:
                raise PermissionError(
                    "Only the author or an admin can delete this publication"
                )

        # Remove all version directories and the publication root
        import shutil
        shutil.rmtree(pub_path)
