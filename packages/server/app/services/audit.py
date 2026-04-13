"""File-based audit logging service (JSONL format)."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class AuditService:
    """Appends audit events to a JSONL log file stored on disk.

    Each line is a JSON object with:
        timestamp, user_id, action, resource, details, ip_address
    """

    def __init__(self, data_dir: str) -> None:
        self.log_path = Path(data_dir) / "system" / "audit.log"
        try:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            logger.warning("Could not create audit log directory: %s", exc)

    async def log(
        self,
        user_id: str,
        action: str,
        resource: str,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """Append a single audit log entry."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": str(user_id),
            "action": action,
            "resource": resource,
            "details": details or {},
            "ip_address": ip_address,
        }
        try:
            with open(self.log_path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry) + "\n")
        except OSError as exc:
            logger.error("Failed to write audit log entry: %s", exc)

    async def query(
        self,
        limit: int = 100,
        offset: int = 0,
        action: Optional[str] = None,
    ) -> list[dict]:
        """Return audit entries, most-recent first.

        Applies optional *action* filter before pagination.
        """
        if not self.log_path.exists():
            return []

        try:
            raw_lines = self.log_path.read_text(encoding="utf-8").splitlines()
        except OSError as exc:
            logger.error("Failed to read audit log: %s", exc)
            return []

        entries: list[dict] = []
        for line in reversed(raw_lines):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if action and entry.get("action") != action:
                continue
            entries.append(entry)

        return entries[offset : offset + limit]
