# MCP Tool Integration

<cite>
**Referenced Files in This Document**
- [index.ts](file://claude_code_src/restored-src/src/commands/mcp/index.ts)
- [mcp.tsx](file://claude_code_src/restored-src/src/commands/mcp/mcp.tsx)
- [mcp.tsx](file://claude_code_src/restored-src/src/cli/handlers/mcp.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [types.ts](file://claude_code_src/restored-src/src/services/mcp/types.ts)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)
- [MCPTool.ts](file://claude_code_src/restored-src/src/tools/MCPTool/)
- [McpAuthTool.ts](file://claude_code_src/restored-src/src/tools/McpAuthTool/)
- [MCPListPanel.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPListPanel.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [MCPRemoteServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPRemoteServerMenu.tsx)
- [MCPStdioServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPStdioServerMenu.tsx)
- [MCPToolListView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolListView.tsx)
- [MCPToolDetailView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolDetailView.tsx)
- [reconnectHelpers.tsx](file://claude_code_src/restored-src/src/components/mcp/utils/reconnectHelpers.tsx)
- [QueryEngine.ts](file://claude_code_src/restored-src/src/QueryEngine.ts)
- [Tool.ts](file://claude_code_src/restored-src/src/Tool.ts)
- [bridgeClient.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts)
- [mcpServer.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts)
- [mcpSocketClient.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts)
- [toolCalls.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/toolCalls.ts)
- [browserTools.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts)
- [mcpServer.ts](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts)
- [tools.ts](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts)
- [types.ts](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/types.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document explains the Model Context Protocol (MCP) integration architecture within the project. It covers MCP tool discovery, execution patterns, and the MCP tool wrapper implementation. It also documents resource listing and reading capabilities, server configuration, authentication, and connection management. Security considerations, sandboxing, performance optimization, caching, connection pooling, and debugging/monitoring/troubleshooting approaches are included, with concrete references to relevant source files.

## Project Structure
The MCP integration spans several areas:
- CLI and command entry points for managing MCP servers
- Services for connection management and channel notifications
- Tools for listing resources, reading resources, and invoking MCP tools
- UI components for server lists, approval dialogs, menus, and tool views
- Utility helpers for reconnect behavior
- Query engine and base tool abstractions
- Node modules implementing Chrome extension MCP server, socket client/pool, and browser automation tools

```mermaid
graph TB
subgraph "CLI"
CMD["commands/mcp/index.ts"]
CMDC["commands/mcp/mcp.tsx"]
CLIH["cli/handlers/mcp.tsx"]
end
subgraph "Services"
CONN["services/mcp/MCPConnectionManager.tsx"]
TYPES["services/mcp/types.ts"]
CHNOTI["services/mcp/channelNotification.js"]
end
subgraph "Tools"
LISTR["ListMcpResourcesTool/"]
READR["ReadMcpResourceTool/"]
MCT["MCPTool/"]
AUTH["McpAuthTool/"]
end
subgraph "Components"
LISTP["MCPListPanel.tsx"]
APPROV["MCPServerApprovalDialog.tsx"]
REMENU["MCPRemoteServerMenu.tsx"]
SMENU["MCPStdioServerMenu.tsx"]
TLVIEW["MCPToolListView.tsx"]
TDET["MCPToolDetailView.tsx"]
RECONN["utils/reconnectHelpers.tsx"]
end
subgraph "Query & Base Types"
QENG["QueryEngine.ts"]
TOOL["Tool.ts"]
end
subgraph "Node Modules"
BRIDGE["@ant/claude-for-chrome-mcp<br/>bridgeClient.ts, mcpServer.ts, mcpSocketClient.ts, mcpSocketPool.ts, toolCalls.ts, browserTools.ts"]
CUSE["@ant/computer-use-mcp<br/>mcpServer.ts, tools.ts, types.ts"]
end
CMD --> CONN
CMDC --> CONN
CLIH --> CONN
CONN --> TYPES
CONN --> CHNOTI
LISTR --> CONN
READR --> CONN
MCT --> CONN
AUTH --> CONN
LISTP --> CONN
APPROV --> CONN
REMENU --> CONN
SMENU --> CONN
TLVIEW --> CONN
TDET --> CONN
RECONN --> CONN
QENG --> CONN
TOOL --> CONN
CONN --> BRIDGE
CONN --> CUSE
```

**Diagram sources**
- [index.ts:1-13](file://claude_code_src/restored-src/src/commands/mcp/index.ts#L1-L13)
- [mcp.tsx](file://claude_code_src/restored-src/src/commands/mcp/mcp.tsx)
- [mcp.tsx](file://claude_code_src/restored-src/src/cli/handlers/mcp.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [types.ts](file://claude_code_src/restored-src/src/services/mcp/types.ts)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)
- [MCPTool.ts](file://claude_code_src/restored-src/src/tools/MCPTool/)
- [McpAuthTool.ts](file://claude_code_src/restored-src/src/tools/McpAuthTool/)
- [MCPListPanel.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPListPanel.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [MCPRemoteServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPRemoteServerMenu.tsx)
- [MCPStdioServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPStdioServerMenu.tsx)
- [MCPToolListView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolListView.tsx)
- [MCPToolDetailView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolDetailView.tsx)
- [reconnectHelpers.tsx](file://claude_code_src/restored-src/src/components/mcp/utils/reconnectHelpers.tsx)
- [QueryEngine.ts:36-36](file://claude_code_src/restored-src/src/QueryEngine.ts#L36-L36)
- [Tool.ts:26-26](file://claude_code_src/restored-src/src/Tool.ts#L26-L26)
- [bridgeClient.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts#L1-L10)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts#L1-L20)
- [mcpSocketClient.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts#L1-L20)
- [toolCalls.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/toolCalls.ts#L1-L10)
- [browserTools.ts:360-375](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts#L360-L375)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts#L1-L20)
- [tools.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts#L1-L10)
- [types.ts:20-30](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/types.ts#L20-L30)

**Section sources**
- [index.ts:1-13](file://claude_code_src/restored-src/src/commands/mcp/index.ts#L1-L13)
- [mcp.tsx](file://claude_code_src/restored-src/src/commands/mcp/mcp.tsx)
- [mcp.tsx](file://claude_code_src/restored-src/src/cli/handlers/mcp.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [types.ts](file://claude_code_src/restored-src/src/services/mcp/types.ts)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)
- [MCPTool.ts](file://claude_code_src/restored-src/src/tools/MCPTool/)
- [McpAuthTool.ts](file://claude_code_src/restored-src/src/tools/McpAuthTool/)
- [MCPListPanel.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPListPanel.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [MCPRemoteServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPRemoteServerMenu.tsx)
- [MCPStdioServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPStdioServerMenu.tsx)
- [MCPToolListView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolListView.tsx)
- [MCPToolDetailView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolDetailView.tsx)
- [reconnectHelpers.tsx](file://claude_code_src/restored-src/src/components/mcp/utils/reconnectHelpers.tsx)
- [QueryEngine.ts:36-36](file://claude_code_src/restored-src/src/QueryEngine.ts#L36-L36)
- [Tool.ts:26-26](file://claude_code_src/restored-src/src/Tool.ts#L26-L26)
- [bridgeClient.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts#L1-L10)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts#L1-L20)
- [mcpSocketClient.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts#L1-L20)
- [toolCalls.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/toolCalls.ts#L1-L10)
- [browserTools.ts:360-375](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts#L360-L375)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts#L1-L20)
- [tools.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts#L1-L10)
- [types.ts:20-30](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/types.ts#L20-L30)

## Core Components
- Command entry points for MCP management:
  - Local JSX command definition and loader for MCP management
  - CLI handler for MCP operations
- Connection management service:
  - Centralized manager for MCP connections and lifecycle
  - Type definitions and channel notification utilities
- Tools:
  - Resource listing and reading tools
  - Generic MCP tool wrapper
  - Authentication tool for MCP
- UI components:
  - Server list panel, approval dialog, remote/stdio server menus
  - Tool list and detail views
  - Reconnect helpers
- Query engine and base tool abstractions:
  - Integration points for MCP-aware queries and tool invocation
- Node modules:
  - Chrome extension MCP server, bridge client, socket client/pool, tool calls, and browser tools
  - Computer-use MCP server and tool schemas

**Section sources**
- [index.ts:1-13](file://claude_code_src/restored-src/src/commands/mcp/index.ts#L1-L13)
- [mcp.tsx](file://claude_code_src/restored-src/src/cli/handlers/mcp.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [types.ts](file://claude_code_src/restored-src/src/services/mcp/types.ts)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)
- [MCPTool.ts](file://claude_code_src/restored-src/src/tools/MCPTool/)
- [McpAuthTool.ts](file://claude_code_src/restored-src/src/tools/McpAuthTool/)
- [MCPListPanel.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPListPanel.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [MCPRemoteServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPRemoteServerMenu.tsx)
- [MCPStdioServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPStdioServerMenu.tsx)
- [MCPToolListView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolListView.tsx)
- [MCPToolDetailView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolDetailView.tsx)
- [reconnectHelpers.tsx](file://claude_code_src/restored-src/src/components/mcp/utils/reconnectHelpers.tsx)
- [QueryEngine.ts:36-36](file://claude_code_src/restored-src/src/QueryEngine.ts#L36-L36)
- [Tool.ts:26-26](file://claude_code_src/restored-src/src/Tool.ts#L26-L26)
- [bridgeClient.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts#L1-L10)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts#L1-L20)
- [mcpSocketClient.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts#L1-L20)
- [toolCalls.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/toolCalls.ts#L1-L10)
- [browserTools.ts:360-375](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts#L360-L375)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts#L1-L20)
- [tools.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts#L1-L10)
- [types.ts:20-30](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/types.ts#L20-L30)

## Architecture Overview
The MCP integration follows a layered architecture:
- Command layer: exposes CLI and local JSX commands to manage MCP servers
- Service layer: manages connections, handles notifications, and orchestrates tool execution
- Tool layer: provides resource listing, reading, generic MCP invocation, and authentication
- UI layer: renders server lists, approvals, menus, and tool views
- Node module integrations: implement Chrome extension MCP server, socket management, and browser automation tools
- Query engine and base tool abstractions: integrate MCP-aware operations into broader workflows

```mermaid
graph TB
CMD["Command Layer<br/>commands/mcp/*"] --> SVC["Service Layer<br/>MCPConnectionManager.tsx"]
SVC --> TOOLS["Tool Layer<br/>ListMcpResourcesTool/, ReadMcpResourceTool/, MCPTool/, McpAuthTool/"]
SVC --> UI["UI Layer<br/>MCPListPanel.tsx, MCPServerApprovalDialog.tsx, menus, tool views"]
SVC --> NM["@ant MCP Modules<br/>bridgeClient.ts, mcpServer.ts, mcpSocketClient.ts, mcpSocketPool.ts, toolCalls.ts, browserTools.ts"]
QRY["Query Engine & Base Types<br/>QueryEngine.ts, Tool.ts"] --> SVC
TOOLS --> SVC
UI --> SVC
NM --> SVC
```

**Diagram sources**
- [index.ts:1-13](file://claude_code_src/restored-src/src/commands/mcp/index.ts#L1-L13)
- [mcp.tsx](file://claude_code_src/restored-src/src/cli/handlers/mcp.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)
- [MCPTool.ts](file://claude_code_src/restored-src/src/tools/MCPTool/)
- [McpAuthTool.ts](file://claude_code_src/restored-src/src/tools/McpAuthTool/)
- [MCPListPanel.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPListPanel.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [MCPRemoteServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPRemoteServerMenu.tsx)
- [MCPStdioServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPStdioServerMenu.tsx)
- [MCPToolListView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolListView.tsx)
- [MCPToolDetailView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolDetailView.tsx)
- [bridgeClient.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts#L1-L10)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts#L1-L20)
- [mcpSocketClient.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts#L1-L20)
- [toolCalls.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/toolCalls.ts#L1-L10)
- [browserTools.ts:360-375](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts#L360-L375)
- [QueryEngine.ts:36-36](file://claude_code_src/restored-src/src/QueryEngine.ts#L36-L36)
- [Tool.ts:26-26](file://claude_code_src/restored-src/src/Tool.ts#L26-L26)

## Detailed Component Analysis

### MCP Tool Discovery and Execution Patterns
- Discovery:
  - Server list panel enumerates available MCP servers and surfaces capabilities
  - Approval dialog governs server enablement and trust decisions
  - Menus support remote and stdio server configurations
- Execution:
  - Generic MCP tool wrapper invokes MCP operations via the connection manager
  - Resource listing and reading tools provide standardized access to MCP resources
  - Authentication tool handles MCP-specific auth flows

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "MCPListPanel.tsx"
participant Conn as "MCPConnectionManager.tsx"
participant Tool as "MCPTool.ts"
participant ResList as "ListMcpResourcesTool.ts"
participant ResRead as "ReadMcpResourceTool.ts"
User->>UI : Select server and open tool list
UI->>Conn : Request server capabilities
Conn-->>UI : Capabilities response
User->>UI : Choose tool
alt Resource listing
UI->>ResList : Invoke tool
ResList->>Conn : List resources
Conn-->>ResList : Resource list
ResList-->>UI : Render list
else Resource reading
UI->>ResRead : Invoke tool
ResRead->>Conn : Read resource
Conn-->>ResRead : Resource content
ResRead-->>UI : Render content
else Generic MCP tool
UI->>Tool : Invoke tool
Tool->>Conn : Execute MCP operation
Conn-->>Tool : Operation result
Tool-->>UI : Render result
end
```

**Diagram sources**
- [MCPListPanel.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPListPanel.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [MCPTool.ts](file://claude_code_src/restored-src/src/tools/MCPTool/)
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)

**Section sources**
- [MCPListPanel.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPListPanel.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [MCPRemoteServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPRemoteServerMenu.tsx)
- [MCPStdioServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPStdioServerMenu.tsx)
- [MCPToolListView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolListView.tsx)
- [MCPToolDetailView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolDetailView.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [MCPTool.ts](file://claude_code_src/restored-src/src/tools/MCPTool/)
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)

### MCP Tool Wrapper Implementation
- Purpose: encapsulates MCP operations behind a consistent interface
- Responsibilities:
  - Delegates to the connection manager for transport and auth
  - Handles tool-specific payload construction and response parsing
  - Integrates with UI tool list/detail views

```mermaid
classDiagram
class MCPTool {
+invoke(args) Promise~Result~
+getSchema() Schema
}
class MCPConnectionManager {
+connect(server) Promise~Connection~
+execute(operation) Promise~Response~
+disconnect(server)
}
class ListMcpResourcesTool {
+invoke() Promise~ResourceList~
}
class ReadMcpResourceTool {
+invoke(uri) Promise~Content~
}
MCPTool --> MCPConnectionManager : "uses"
ListMcpResourcesTool --> MCPConnectionManager : "uses"
ReadMcpResourceTool --> MCPConnectionManager : "uses"
```

**Diagram sources**
- [MCPTool.ts](file://claude_code_src/restored-src/src/tools/MCPTool/)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)

**Section sources**
- [MCPTool.ts](file://claude_code_src/restored-src/src/tools/MCPTool/)
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)

### Resource Listing and Reading Mechanisms
- Resource listing:
  - Lists resources exposed by an MCP server
  - Drives UI tool list view and supports filtering and pagination
- Resource reading:
  - Reads content from MCP resources by URI
  - Supports streaming or batch retrieval depending on server capability

```mermaid
flowchart TD
Start(["Invoke Resource Tool"]) --> Choose{"Operation Type"}
Choose --> |List| ListReq["ListMcpResourcesTool.invoke()"]
Choose --> |Read| ReadReq["ReadMcpResourceTool.invoke(uri)"]
ListReq --> Conn["MCPConnectionManager.execute()"]
ReadReq --> Conn
Conn --> Resp{"Response OK?"}
Resp --> |Yes| Render["Render UI"]
Resp --> |No| Error["Emit Error"]
Render --> End(["Done"])
Error --> End
```

**Diagram sources**
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)

**Section sources**
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)

### MCP Server Configuration, Authentication, and Connection Management
- Configuration:
  - Remote and stdio server menus define server endpoints and transport
  - Approval dialog enforces trust and enablement policies
- Authentication:
  - Authentication tool coordinates MCP auth flows
  - Connection manager integrates auth tokens and credentials
- Connection management:
  - Centralized connection lifecycle management
  - Channel notifications propagate server events to UI
  - Reconnect helpers handle transient failures

```mermaid
sequenceDiagram
participant User as "User"
participant Menu as "MCPRemoteServerMenu.tsx / MCPStdioServerMenu.tsx"
participant Approv as "MCPServerApprovalDialog.tsx"
participant Conn as "MCPConnectionManager.tsx"
participant Auth as "McpAuthTool.ts"
participant Noti as "channelNotification.js"
User->>Menu : Add/Configure server
Menu->>Approv : Request approval
Approv-->>Menu : Approved/Rejected
Menu->>Conn : Initialize connection
Conn->>Auth : Authenticate if required
Auth-->>Conn : Auth result
Conn->>Noti : Subscribe to notifications
Noti-->>User : Show status updates
```

**Diagram sources**
- [MCPRemoteServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPRemoteServerMenu.tsx)
- [MCPStdioServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPStdioServerMenu.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [McpAuthTool.ts](file://claude_code_src/restored-src/src/tools/McpAuthTool.ts)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)

**Section sources**
- [MCPRemoteServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPRemoteServerMenu.tsx)
- [MCPStdioServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPStdioServerMenu.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [McpAuthTool.ts](file://claude_code_src/restored-src/src/tools/McpAuthTool.ts)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)

### Permission Mapping, Security Considerations, and Sandboxing
- Permission mapping:
  - Tools declare capabilities and required permissions
  - UI surfaces permission requirements and approval prompts
- Security considerations:
  - Approval dialog governs server trust and enablement
  - Browser automation tools include explicit warnings and constraints
- Sandboxing approaches:
  - Chrome extension MCP server isolates tool execution
  - Computer-use MCP server restricts actions and provides guardrails

```mermaid
flowchart TD
PStart(["Tool Registration"]) --> Decl["Declare Permissions"]
Decl --> UI["Show Permission Prompt"]
UI --> Approve{"User Approves?"}
Approve --> |Yes| Enable["Enable Tool Access"]
Approve --> |No| Deny["Deny Access"]
Enable --> Exec["Execute Tool"]
Deny --> End(["Abort"])
Exec --> End
```

**Diagram sources**
- [MCPToolListView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolListView.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [browserTools.ts:360-375](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts#L360-L375)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts#L1-L20)

**Section sources**
- [MCPToolListView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolListView.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [browserTools.ts:360-375](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts#L360-L375)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts#L1-L20)

### Debugging, Monitoring, and Troubleshooting
- Debugging:
  - Tool call logs and error propagation from node modules
  - Socket client error handling and reconnect helpers
- Monitoring:
  - Channel notifications for server status and events
  - UI components surface connection state and errors
- Troubleshooting:
  - Reconnect helpers for transient failures
  - Approval dialogs for trust and policy issues

```mermaid
sequenceDiagram
participant Dev as "Developer"
participant Conn as "MCPConnectionManager.tsx"
participant Pool as "mcpSocketPool.ts"
participant Client as "mcpSocketClient.ts"
participant Noti as "channelNotification.js"
participant UI as "MCPListPanel.tsx"
Dev->>Conn : Initiate operation
Conn->>Pool : Acquire socket
Pool-->>Conn : Socket ready
Conn->>Client : Send request
Client-->>Conn : Response/Error
Conn->>Noti : Emit notification
Noti-->>UI : Update UI
UI-->>Dev : Show status/error
```

**Diagram sources**
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [mcpSocketPool.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts#L1-L20)
- [mcpSocketClient.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)
- [MCPListPanel.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPListPanel.tsx)

**Section sources**
- [toolCalls.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/toolCalls.ts#L1-L10)
- [mcpSocketPool.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts#L1-L20)
- [mcpSocketClient.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)
- [MCPListPanel.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPListPanel.tsx)
- [reconnectHelpers.tsx](file://claude_code_src/restored-src/src/components/mcp/utils/reconnectHelpers.tsx)

## Dependency Analysis
- Command layer depends on service layer for connection orchestration
- Tool layer depends on service layer for transport and auth
- UI layer depends on service layer for state and notifications
- Node modules provide transport, socket management, and browser automation
- Query engine and base tool abstractions depend on service types

```mermaid
graph LR
CMD["commands/mcp/index.ts"] --> SVC["MCPConnectionManager.tsx"]
CMDC["commands/mcp/mcp.tsx"] --> SVC
CLIH["cli/handlers/mcp.tsx"] --> SVC
SVC --> TYPES["services/mcp/types.ts"]
SVC --> CHNOTI["services/mcp/channelNotification.js"]
LISTR["ListMcpResourcesTool.ts"] --> SVC
READR["ReadMcpResourceTool.ts"] --> SVC
MCT["MCPTool.ts"] --> SVC
AUTH["McpAuthTool.ts"] --> SVC
LISTP["MCPListPanel.tsx"] --> SVC
APPROV["MCPServerApprovalDialog.tsx"] --> SVC
REMENU["MCPRemoteServerMenu.tsx"] --> SVC
SMENU["MCPStdioServerMenu.tsx"] --> SVC
TLVIEW["MCPToolListView.tsx"] --> SVC
TDET["MCPToolDetailView.tsx"] --> SVC
RECONN["utils/reconnectHelpers.tsx"] --> SVC
QENG["QueryEngine.ts"] --> SVC
TOOL["Tool.ts"] --> SVC
SVC --> BRIDGE["@ant/claude-for-chrome-mcp"]
SVC --> CUSE["@ant/computer-use-mcp"]
```

**Diagram sources**
- [index.ts:1-13](file://claude_code_src/restored-src/src/commands/mcp/index.ts#L1-L13)
- [mcp.tsx](file://claude_code_src/restored-src/src/commands/mcp/mcp.tsx)
- [mcp.tsx](file://claude_code_src/restored-src/src/cli/handlers/mcp.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [types.ts](file://claude_code_src/restored-src/src/services/mcp/types.ts)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)
- [ListMcpResourcesTool.ts](file://claude_code_src/restored-src/src/tools/ListMcpResourcesTool/)
- [ReadMcpResourceTool.ts](file://claude_code_src/restored-src/src/tools/ReadMcpResourceTool/)
- [MCPTool.ts](file://claude_code_src/restored-src/src/tools/MCPTool/)
- [McpAuthTool.ts](file://claude_code_src/restored-src/src/tools/McpAuthTool/)
- [MCPListPanel.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPListPanel.tsx)
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [MCPRemoteServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPRemoteServerMenu.tsx)
- [MCPStdioServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPStdioServerMenu.tsx)
- [MCPToolListView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolListView.tsx)
- [MCPToolDetailView.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPToolDetailView.tsx)
- [reconnectHelpers.tsx](file://claude_code_src/restored-src/src/components/mcp/utils/reconnectHelpers.tsx)
- [QueryEngine.ts:36-36](file://claude_code_src/restored-src/src/QueryEngine.ts#L36-L36)
- [Tool.ts:26-26](file://claude_code_src/restored-src/src/Tool.ts#L26-L26)
- [bridgeClient.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts#L1-L10)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts#L1-L20)
- [mcpSocketClient.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts#L1-L20)
- [toolCalls.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/toolCalls.ts#L1-L10)
- [browserTools.ts:360-375](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts#L360-L375)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts#L1-L20)
- [tools.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts#L1-L10)
- [types.ts:20-30](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/types.ts#L20-L30)

**Section sources**
- [index.ts:1-13](file://claude_code_src/restored-src/src/commands/mcp/index.ts#L1-L13)
- [mcp.tsx](file://claude_code_src/restored-src/src/cli/handlers/mcp.tsx)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [types.ts](file://claude_code_src/restored-src/src/services/mcp/types.ts)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)
- [QueryEngine.ts:36-36](file://claude_code_src/restored-src/src/QueryEngine.ts#L36-L36)
- [Tool.ts:26-26](file://claude_code_src/restored-src/src/Tool.ts#L26-L26)
- [bridgeClient.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts#L1-L10)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts#L1-L20)
- [mcpSocketClient.ts](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts#L1-L20)
- [toolCalls.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/toolCalls.ts#L1-L10)
- [browserTools.ts:360-375](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts#L360-L375)
- [mcpServer.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts#L1-L20)
- [tools.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts#L1-L10)
- [types.ts:20-30](file://claude_code_src/restored-src/node_modules/@ant/computer-use-mcp/src/types.ts#L20-L30)

## Performance Considerations
- Connection pooling:
  - Socket pool manages reusable connections to reduce overhead
- Caching:
  - Resource listings and metadata can be cached to minimize repeated queries
- Connection management:
  - Centralized connection lifecycle reduces redundant handshakes
- Transport efficiency:
  - Batch operations where supported by MCP servers
- UI responsiveness:
  - Non-blocking UI updates with notifications and reconnect helpers

**Section sources**
- [mcpSocketPool.ts:1-20](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts#L1-L20)
- [MCPConnectionManager.tsx](file://claude_code_src/restored-src/src/services/mcp/MCPConnectionManager.tsx)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)

## Troubleshooting Guide
- Common issues:
  - Server not responding: check approval status and connectivity
  - Tool execution failures: inspect tool call logs and socket client errors
  - Permission denials: verify approvals and permission mappings
- Diagnostic steps:
  - Review channel notifications for status updates
  - Use reconnect helpers for transient failures
  - Validate server configuration in menus

**Section sources**
- [MCPServerApprovalDialog.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPServerApprovalDialog.tsx)
- [MCPRemoteServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPRemoteServerMenu.tsx)
- [MCPStdioServerMenu.tsx](file://claude_code_src/restored-src/src/components/mcp/MCPStdioServerMenu.tsx)
- [toolCalls.ts:1-10](file://claude_code_src/restored-src/node_modules/@ant/claude-for-chrome-mcp/src/toolCalls.ts#L1-L10)
- [reconnectHelpers.tsx](file://claude_code_src/restored-src/src/components/mcp/utils/reconnectHelpers.tsx)
- [channelNotification.js](file://claude_code_src/restored-src/src/services/mcp/channelNotification.js)

## Conclusion
The MCP integration provides a robust, modular framework for discovering, authorizing, and executing MCP tools while maintaining strong security boundaries and operational reliability. The layered architecture enables clear separation of concerns, while the UI and service layers offer rich user experiences and resilient connection management. By leveraging connection pooling, caching, and comprehensive error handling, the system supports scalable and maintainable MCP workflows.