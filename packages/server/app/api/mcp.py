"""
MCP Proxy API Routes
====================
REST endpoints for managing server-side MCP server processes and proxying
tool calls from desktop clients.
"""

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from ..core.security import get_current_user
from ..models.mcp import ServerStatusResponse, ToolCallRequest, ToolCallResponse
from ..services.mcp_proxy import get_mcp_proxy_manager

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Server management
# ---------------------------------------------------------------------------


@router.get("/servers", response_model=List[ServerStatusResponse])
async def list_servers(user=Depends(get_current_user)):
    """List all registered MCP servers and their running status."""
    manager = get_mcp_proxy_manager()
    statuses = manager.get_server_status()

    result: List[ServerStatusResponse] = []
    for entry in statuses:
        tools: List[Dict[str, Any]] = []
        if entry["running"]:
            try:
                server_tools = await manager.list_all_tools()
                tools = server_tools.get(entry["name"], [])
            except Exception as exc:  # noqa: BLE001
                logger.warning("Could not fetch tools for '%s': %s", entry["name"], exc)

        result.append(
            ServerStatusResponse(
                name=entry["name"],
                running=entry["running"],
                tools=tools,
            )
        )
    return result


@router.post("/servers/{name}/start", response_model=ServerStatusResponse)
async def start_server(name: str, user=Depends(get_current_user)):
    """Start the named MCP server subprocess."""
    manager = get_mcp_proxy_manager()
    if name not in manager.servers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{name}' is not configured",
        )
    try:
        await manager.start_server(name)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start MCP server '{name}': {exc}",
        ) from exc

    tools: List[Dict[str, Any]] = []
    try:
        all_tools = await manager.list_all_tools()
        tools = all_tools.get(name, [])
    except Exception:  # noqa: BLE001
        pass

    return ServerStatusResponse(name=name, running=True, tools=tools)


@router.post("/servers/{name}/stop", response_model=ServerStatusResponse)
async def stop_server(name: str, user=Depends(get_current_user)):
    """Stop the named MCP server subprocess."""
    manager = get_mcp_proxy_manager()
    if name not in manager.servers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{name}' is not configured",
        )
    try:
        await manager.stop_server(name)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop MCP server '{name}': {exc}",
        ) from exc

    return ServerStatusResponse(name=name, running=False, tools=[])


# ---------------------------------------------------------------------------
# Tool discovery
# ---------------------------------------------------------------------------


@router.get("/tools")
async def list_tools(user=Depends(get_current_user)):
    """List all available tools from every running MCP server.

    Returns a mapping of ``{ server_name: [ tool, ... ] }``.
    """
    manager = get_mcp_proxy_manager()
    try:
        tools = await manager.list_all_tools()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list tools: {exc}",
        ) from exc
    return tools


# ---------------------------------------------------------------------------
# Tool invocation
# ---------------------------------------------------------------------------


@router.post("/tools/call", response_model=ToolCallResponse)
async def call_tool(request: ToolCallRequest, user=Depends(get_current_user)):
    """Proxy a tool call to the specified MCP server.

    The request body must contain:
    - ``server``: the registered server name
    - ``tool``: the tool name to invoke
    - ``arguments``: a dict of tool arguments (may be empty)
    """
    manager = get_mcp_proxy_manager()

    # Validate server exists
    if request.server not in manager.servers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"MCP server '{request.server}' is not configured",
        )

    # Validate server is running
    server = manager.servers[request.server]
    if not server.is_running:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"MCP server '{request.server}' is not running. "
                f"Start it first via POST /api/v1/mcp/servers/{request.server}/start"
            ),
        )

    try:
        result = await manager.call_tool(request.server, request.tool, request.arguments)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception(
            "Unexpected error calling tool '%s' on server '%s'",
            request.tool,
            request.server,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tool call failed: {exc}",
        ) from exc

    return ToolCallResponse(
        server=request.server,
        tool=request.tool,
        result=result,
    )
