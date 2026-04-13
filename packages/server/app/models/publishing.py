"""Pydantic models for the code-publishing feature."""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class Visibility(str, Enum):
    PRIVATE = "private"
    TEAM = "team"
    PUBLIC = "public"


class PublishRequest(BaseModel):
    title: str
    description: Optional[str] = None
    source_code: str
    outputs: Optional[List[dict]] = None  # Cell output snapshots
    visibility: Visibility = Visibility.PUBLIC
    tags: Optional[List[str]] = None
    environment: Optional[dict] = None  # e.g. {"python_version": "3.11", "packages": [...]}


class PublishResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    author: str
    visibility: Visibility
    version: int
    created_at: str
    share_url: str


class PublishedScript(BaseModel):
    id: str
    title: str
    description: Optional[str]
    author: str
    source_code: str
    outputs: Optional[List[dict]]
    visibility: Visibility
    version: int
    versions: List[int]   # All available version numbers
    tags: List[str]
    environment: Optional[dict]
    created_at: str
    updated_at: str


class VersionInfo(BaseModel):
    version: int
    created_at: str
    description: Optional[str]
