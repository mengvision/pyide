"""Environment template management API endpoints.

Allows users to list available Python environment templates,
and admins to create/manage templates for remote kernels.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db.session import get_db
from ..db.models import User, EnvironmentTemplate
from ..core.security import get_current_user
from ..core.uv_manager import uv_manager, UVError

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request/Response schemas
# ---------------------------------------------------------------------------

class TemplateInfo(BaseModel):
    """Environment template information returned to clients."""
    id: int
    name: str
    display_name: str
    python_version: str
    packages: list[str]
    description: Optional[str] = None
    is_active: bool


class CreateTemplateRequest(BaseModel):
    """Request to create a new environment template."""
    name: str
    display_name: str
    python_version: str
    packages: list[str] = []
    description: Optional[str] = None


class UpdateTemplateRequest(BaseModel):
    """Request to update an existing template."""
    display_name: Optional[str] = None
    python_version: Optional[str] = None
    packages: Optional[list[str]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _require_admin(user: User):
    """Raise HTTP 403 if user is not an admin."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )


def _template_to_info(template: EnvironmentTemplate) -> TemplateInfo:
    """Convert DB model to response schema."""
    return TemplateInfo(
        id=template.id,
        name=template.name,
        display_name=template.display_name,
        python_version=template.python_version,
        packages=json.loads(template.packages),
        description=template.description,
        is_active=template.is_active,
    )


# ---------------------------------------------------------------------------
# Public endpoints (available to all authenticated users)
# ---------------------------------------------------------------------------

@router.get(
    "/templates",
    response_model=list[TemplateInfo],
    summary="List available environment templates",
)
async def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all active environment templates available for remote kernels."""
    templates = (
        db.query(EnvironmentTemplate)
        .filter(EnvironmentTemplate.is_active == True)
        .order_by(EnvironmentTemplate.name)
        .all()
    )
    return [_template_to_info(t) for t in templates]


# ---------------------------------------------------------------------------
# Admin-only endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/templates",
    response_model=TemplateInfo,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new environment template (admin only)",
)
async def create_template(
    data: CreateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new environment template.
    
    This only stores the template configuration in the database.
    The actual Python environment is created lazily when a user first
    requests a kernel with this template.
    
    To pre-install packages, use the /prewarm endpoint.
    """
    _require_admin(current_user)
    
    # Check if template name already exists
    existing = db.query(EnvironmentTemplate).filter(
        EnvironmentTemplate.name == data.name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Template '{data.name}' already exists",
        )
    
    # Validate Python version format
    if not data.python_version.replace(".", "").isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Python version format (e.g., '3.12' or '3.11.5')",
        )
    
    # Create template
    template = EnvironmentTemplate(
        name=data.name,
        display_name=data.display_name,
        python_version=data.python_version,
        packages=json.dumps(data.packages),
        description=data.description,
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    logger.info(
        "Admin %s created environment template: %s",
        current_user.username, template.name,
    )
    
    return _template_to_info(template)


@router.put(
    "/templates/{template_id}",
    response_model=TemplateInfo,
    summary="Update an environment template (admin only)",
)
async def update_template(
    template_id: int,
    data: UpdateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing environment template."""
    _require_admin(current_user)
    
    template = db.query(EnvironmentTemplate).filter(
        EnvironmentTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    # Update fields
    if data.display_name is not None:
        template.display_name = data.display_name
    if data.python_version is not None:
        template.python_version = data.python_version
    if data.packages is not None:
        template.packages = json.dumps(data.packages)
    if data.description is not None:
        template.description = data.description
    if data.is_active is not None:
        template.is_active = data.is_active
    
    db.commit()
    db.refresh(template)
    
    logger.info(
        "Admin %s updated environment template: %s",
        current_user.username, template.name,
    )
    
    return _template_to_info(template)


@router.delete(
    "/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate an environment template (admin only)",
)
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deactivate (soft delete) an environment template.
    
    Existing kernels using this template will continue to work.
    New kernels cannot be started with a deactivated template.
    """
    _require_admin(current_user)
    
    template = db.query(EnvironmentTemplate).filter(
        EnvironmentTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    template.is_active = False
    db.commit()
    
    logger.info(
        "Admin %s deactivated environment template: %s",
        current_user.username, template.name,
    )


@router.post(
    "/templates/{template_id}/prewarm",
    summary="Pre-install Python version and packages for a template (admin only)",
)
async def prewarm_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pre-install the Python version and packages for a template.
    
    This is optional but recommended for faster first-time kernel startup.
    Creates the base environment at /pyide-data/templates/{template_name}/.
    """
    _require_admin(current_user)
    
    template = db.query(EnvironmentTemplate).filter(
        EnvironmentTemplate.id == template_id
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    
    packages = json.loads(template.packages)
    
    try:
        # Check uv is installed
        await uv_manager.ensure_uv_installed()
        
        # Install Python version
        logger.info(
            "Prewarming template %s: installing Python %s",
            template.name, template.python_version,
        )
        await uv_manager.install_python_version(template.python_version)
        
        # Create base venv
        from ..core.config import settings
        base_dir = os.environ.get("PYIDE_DATA_DIR", settings.PYIDE_DATA_DIR)
        template_venv_path = os.path.join(base_dir, "templates", template.name)
        
        logger.info("Creating base venv at %s", template_venv_path)
        await uv_manager.create_venv(
            template_venv_path,
            template.python_version,
        )
        
        # Install packages
        if packages:
            logger.info("Installing %d packages", len(packages))
            await uv_manager.install_packages(template_venv_path, packages)
        
        return {
            "status": "success",
            "message": f"Template '{template.name}' prewarmed successfully",
            "python_version": template.python_version,
            "packages_installed": len(packages),
            "venv_path": template_venv_path,
        }
        
    except UVError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to prewarm template: {str(exc)}",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error during prewarm")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error: {str(exc)}",
        ) from exc
