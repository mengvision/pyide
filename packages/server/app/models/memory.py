from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class MemoryPermission(str, Enum):
    PUBLIC = "public"          # All team members can read
    DEPARTMENT = "department"  # Department members only (treated as public for now)
    SENSITIVE = "sensitive"    # Admin-only


class MemoryLayer(str, Enum):
    TEAM = "team"
    PROJECT = "project"


class TeamMemoryCreate(BaseModel):
    content: str
    tags: Optional[List[str]] = None
    permission: MemoryPermission = MemoryPermission.PUBLIC
    category: Optional[str] = None  # e.g. "best-practices", "conventions"


class TeamMemoryUpdate(BaseModel):
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    permission: Optional[MemoryPermission] = None
    category: Optional[str] = None


class TeamMemoryResponse(BaseModel):
    id: str
    content: str
    author: str
    tags: List[str]
    permission: str
    category: Optional[str]
    created_at: str
    updated_at: str
