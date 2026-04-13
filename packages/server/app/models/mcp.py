from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class ServerConfig(BaseModel):
    """Configuration for a single MCP server process."""
    command: str
    args: List[str] = []
    env: Dict[str, str] = {}


class MCPConfig(BaseModel):
    """Top-level MCP configuration (mcp.json)."""
    servers: Dict[str, ServerConfig] = {}


class ToolCallRequest(BaseModel):
    """Request to proxy a tool call to an MCP server."""
    server: str
    tool: str
    arguments: Dict[str, Any] = {}


class ToolCallResponse(BaseModel):
    """Response from an MCP tool call."""
    server: str
    tool: str
    result: Any = None
    error: Optional[str] = None


class ServerStatusResponse(BaseModel):
    """Status of a single MCP server."""
    name: str
    running: bool
    tools: List[Dict[str, Any]] = []
    error: Optional[str] = None
