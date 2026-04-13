"""Pydantic request/response models for admin endpoints."""

from typing import Optional
from pydantic import BaseModel


class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    is_admin: bool = False


class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    cpu_limit: Optional[int] = None    # CPU millicores, None = unlimited
    memory_limit: Optional[int] = None # MB, None = unlimited


class ResetPasswordRequest(BaseModel):
    new_password: str


class TeamSettings(BaseModel):
    allow_public_publishing: bool = True
    allow_skill_install: bool = True
    allow_mcp_servers: bool = True
    max_kernel_idle_minutes: int = 60


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_admin: bool
    cpu_limit: Optional[int] = None
    memory_limit: Optional[int] = None

    class Config:
        from_attributes = True
