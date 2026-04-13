from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    cpu_limit = Column(Integer, nullable=True)        # CPU millicores, None = unlimited
    memory_limit = Column(Integer, nullable=True)     # MB, None = unlimited
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workspaces = relationship("Workspace", back_populates="owner")

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="workspaces")
    kernels = relationship("Kernel", back_populates="workspace")
    published_codes = relationship("PublishedCode", back_populates="workspace")

class PublishedCode(Base):
    __tablename__ = "published_code"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    title = Column(String(200), nullable=False)
    code_content = Column(Text, nullable=False)
    output_snapshot = Column(Text, nullable=True)
    visibility = Column(String(20), default="private") # private, team, public
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workspace = relationship("Workspace", back_populates="published_codes")

class EnvironmentTemplate(Base):
    """Shared Python environment templates configured by admins.
    
    Templates define Python version and pre-installed packages.
    Users can select a template when starting a remote kernel.
    """
    __tablename__ = "environment_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)  # e.g., "data-science"
    display_name = Column(String(200), nullable=False)       # e.g., "Data Science Environment"
    python_version = Column(String(20), nullable=False)      # e.g., "3.12"
    packages = Column(Text, nullable=False)                  # JSON: ["pandas", "numpy", "matplotlib"]
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Kernel(Base):
    __tablename__ = "kernels"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    status = Column(String(20), default="stopped") # stopped, starting, running, error
    container_id = Column(String(100), nullable=True)
    env_template_id = Column(Integer, ForeignKey("environment_templates.id"), nullable=True)
    venv_path = Column(String(500), nullable=True)  # Path to user's venv copy
    last_active = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="kernels")
    env_template = relationship("EnvironmentTemplate")
