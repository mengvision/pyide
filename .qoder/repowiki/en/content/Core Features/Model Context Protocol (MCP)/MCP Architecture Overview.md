# MCP Architecture Overview

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [MCPTool.ts](file://restored-src/src/tools/MCPTool/MCPTool.ts)
- [mcp.tsx](file://restored-src/src/cli/handlers/mcp.tsx)
- [print.ts](file://restored-src/src/cli/print.ts)
- [config.ts](file://restored-src/src/services/mcp/config.ts)
- [runAgent.ts](file://restored-src/src/tools/AgentTool/runAgent.ts)
- [MCPServerApprovalDialog.tsx](file://restored-src/src/components/MCPServerApprovalDialog.tsx)
- [MCPServerDesktopImportDialog.tsx](file://restored-src/src/components/MCPServerDesktopImportDialog.tsx)
- [bridgeClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts)
- [mcpServer.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts)
- [mcpSocketClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts)
- [browserTools.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts)
- [computer-mcp mcpServer.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts)
- [computer-mcp toolCalls.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/toolCalls.ts)
- [computer-mcp tools.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts)
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
This document explains the Model Context Protocol (MCP) architecture and implementation within Claude Code. It covers the MCP protocol fundamentals, the server-client relationship, communication patterns, capabilities, resource management, authentication mechanisms, server discovery and connection establishment, capability negotiation, protocol versioning, security considerations, and performance characteristics. The goal is to provide both conceptual understanding for users and practical guidance for developers integrating MCP into Claude Code.

## Project Structure
The MCP implementation spans several areas:
- CLI handlers for managing MCP servers and connectivity
- Service-side configuration and policy enforcement
- Tool abstractions for invoking MCP resources
- UI dialogs for approval and import workflows
- Node-based MCP bridge and socket infrastructure for browser-based MCP servers
- Computer-use MCP extensions for UI automation

```mermaid
graph TB
subgraph "CLI"
CLI_MCP["CLI Handlers<br/>mcp.tsx"]
CLI_Print["CLI Print Utilities<br/>print.ts"]
end
subgraph "Services"
SVC_Config["MCP Config & Policy<br/>config.ts"]
SVC_RunAgent["Agent Runtime<br/>runAgent.ts"]
end
subgraph "Tools"
TOOL_MCP["MCPTool Abstraction<br/>MCPTool.ts"]
end
subgraph "UI"
UI_Approval["Approval Dialog<br/>MCPServerApprovalDialog.tsx"]
UI_Import["Desktop Import Dialog<br/>MCPServerDesktopImportDialog.tsx"]
end
subgraph "Browser MCP Bridge"
BR_Clt["Bridge Client<br/>bridgeClient.ts"]
BR_Srv["MCP Server<br/>mcpServer.ts"]
BR_Sock["Socket Client<br/>mcpSocketClient.ts"]
BR_Pool["Socket Pool<br/>mcpSocketPool.ts"]
BR_BTools["Browser Tools<br/>browserTools.ts"]
end
subgraph "Computer Use MCP"
CU_Srv["MCP Server<br/>computer-mcp mcpServer.ts"]
CU_Tools["Tools & Calls<br/>computer-mcp toolCalls.ts / tools.ts"]
end
CLI_MCP --> SVC_Config
CLI_MCP --> SVC_RunAgent
SVC_RunAgent --> TOOL_MCP
SVC_Config --> TOOL_MCP
TOOL_MCP --> BR_Clt
BR_Clt --> BR_Srv
BR_Clt --> BR_Sock
BR_Clt --> BR_Pool
BR_Clt --> BR_BTools
BR_Clt --> CU_Srv
BR_Clt --> CU_Tools
UI_Approval --> SVC_Config
UI_Import --> SVC_Config
CLI_Print --> SVC_Config
```

**Diagram sources**
- [mcp.tsx:22-210](file://restored-src/src/cli/handlers/mcp.tsx#L22-L210)
- [print.ts:5446-5479](file://restored-src/src/cli/print.ts#L5446-L5479)
- [config.ts:657-679](file://restored-src/src/services/mcp/config.ts#L657-L679)
- [runAgent.ts:140-177](file://restored-src/src/tools/AgentTool/runAgent.ts#L140-L177)
- [MCPTool.ts:1-78](file://restored-src/src/tools/MCPTool/MCPTool.ts#L1-L78)
- [MCPServerApprovalDialog.tsx](file://restored-src/src/components/MCPServerApprovalDialog.tsx)
- [MCPServerDesktopImportDialog.tsx](file://restored-src/src/components/MCPServerDesktopImportDialog.tsx)
- [bridgeClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts)
- [mcpServer.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts)
- [mcpSocketClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts)
- [browserTools.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts)
- [computer-mcp mcpServer.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts)
- [computer-mcp toolCalls.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/toolCalls.ts)
- [computer-mcp tools.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts)

**Section sources**
- [README.md:13-49](file://README.md#L13-L49)

## Core Components
- MCPTool abstraction: Provides a standardized tool interface for invoking MCP resources, including permission handling, output rendering, and truncation checks.
- CLI MCP handlers: Offer commands to serve, inspect, and manage MCP servers, including health checks and status reporting.
- Service configuration and policy: Enforce allow/deny policies, validate configurations, and reconcile dynamic server states.
- Agent runtime: Resolves named MCP servers, connects to them, and manages lifecycle for agent-specific servers.
- Browser MCP bridge: Implements a WebSocket-based bridge client and server, along with socket pooling and browser automation tools.
- Computer-use MCP: Extends MCP with UI automation capabilities via specialized tools and server logic.

**Section sources**
- [MCPTool.ts:1-78](file://restored-src/src/tools/MCPTool/MCPTool.ts#L1-L78)
- [mcp.tsx:22-210](file://restored-src/src/cli/handlers/mcp.tsx#L22-L210)
- [config.ts:657-679](file://restored-src/src/services/mcp/config.ts#L657-L679)
- [runAgent.ts:140-177](file://restored-src/src/tools/AgentTool/runAgent.ts#L140-L177)
- [bridgeClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts)
- [mcpServer.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts)
- [mcpSocketClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts)
- [browserTools.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts)
- [computer-mcp mcpServer.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts)
- [computer-mcp toolCalls.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/toolCalls.ts)
- [computer-mcp tools.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts)

## Architecture Overview
The MCP architecture in Claude Code consists of:
- Client-side tooling and agent runtime that discover and connect to MCP servers
- Service-side configuration and policy enforcement
- CLI utilities for server management and diagnostics
- Browser-based MCP bridge for extension-backed MCP servers
- Computer-use MCP for UI automation

```mermaid
sequenceDiagram
participant User as "User"
participant CLI as "CLI Handler<br/>mcp.tsx"
participant Agent as "Agent Runtime<br/>runAgent.ts"
participant Tool as "MCPTool<br/>MCPTool.ts"
participant Svc as "Service Config<br/>config.ts"
participant Bridge as "Bridge Client<br/>bridgeClient.ts"
participant Srv as "MCP Server<br/>mcpServer.ts"
User->>CLI : "mcp serve/get/status"
CLI->>Svc : "Validate config/policy"
Svc-->>CLI : "Validation result"
User->>Agent : "Run task requiring MCP"
Agent->>Svc : "Resolve server config"
Agent->>Bridge : "Connect to MCP server"
Bridge->>Srv : "Negotiate capabilities"
Agent->>Tool : "Invoke MCP resource"
Tool->>Bridge : "Send request"
Bridge->>Srv : "Forward request"
Srv-->>Bridge : "Response"
Bridge-->>Tool : "Response"
Tool-->>Agent : "Result"
Agent-->>User : "Outcome"
```

**Diagram sources**
- [mcp.tsx:22-210](file://restored-src/src/cli/handlers/mcp.tsx#L22-L210)
- [runAgent.ts:140-177](file://restored-src/src/tools/AgentTool/runAgent.ts#L140-L177)
- [MCPTool.ts:1-78](file://restored-src/src/tools/MCPTool/MCPTool.ts#L1-L78)
- [config.ts:657-679](file://restored-src/src/services/mcp/config.ts#L657-L679)
- [bridgeClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts)
- [mcpServer.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts)

## Detailed Component Analysis

### MCPTool Abstraction
MCPTool defines a standardized tool interface for MCP resources:
- Input/output schemas support flexible MCP-defined structures
- Permission handling and user-facing messaging
- Rendering helpers for tool use, progress, and results
- Truncation checks for long outputs

```mermaid
classDiagram
class MCPTool {
+boolean isMcp
+string name
+number maxResultSizeChars
+description() string
+prompt() string
+inputSchema
+outputSchema
+call(...)
+checkPermissions() PermissionResult
+renderToolUseMessage(...)
+renderToolUseProgressMessage(...)
+renderToolResultMessage(...)
+isResultTruncated(output) bool
+mapToolResultToToolResultBlockParam(...)
}
```

**Diagram sources**
- [MCPTool.ts:27-77](file://restored-src/src/tools/MCPTool/MCPTool.ts#L27-L77)

**Section sources**
- [MCPTool.ts:1-78](file://restored-src/src/tools/MCPTool/MCPTool.ts#L1-L78)

### CLI MCP Management
The CLI provides commands to:
- Serve MCP servers
- Inspect server status and health
- Retrieve server configuration details

```mermaid
flowchart TD
Start(["CLI Command"]) --> Parse["Parse Arguments"]
Parse --> Action{"Action Type"}
Action --> |serve| StartSrv["Start MCP Server"]
Action --> |get| GetCfg["Get Server Config"]
Action --> |status| Health["Check Health"]
StartSrv --> Done(["Done"])
GetCfg --> Done
Health --> Done
```

**Diagram sources**
- [mcp.tsx:22-210](file://restored-src/src/cli/handlers/mcp.tsx#L22-L210)

**Section sources**
- [mcp.tsx:22-210](file://restored-src/src/cli/handlers/mcp.tsx#L22-L210)

### Service Configuration and Policy
Service-side configuration enforces:
- Schema validation for MCP server configs
- Enterprise allow/deny policies
- Dynamic server reconciliation (add/remove/replace)

```mermaid
flowchart TD
Cfg["Incoming Config"] --> Validate["Validate Schema"]
Validate --> Allowed{"Allowed by Policy?"}
Allowed --> |No| Deny["Reject: Blocked"]
Allowed --> |Yes| Persist["Persist Config"]
Persist --> Reconcile["Reconcile Dynamic Servers"]
Reconcile --> Done(["Ready"])
```

**Diagram sources**
- [config.ts:657-679](file://restored-src/src/services/mcp/config.ts#L657-L679)
- [print.ts:5446-5479](file://restored-src/src/cli/print.ts#L5446-L5479)

**Section sources**
- [config.ts:657-679](file://restored-src/src/services/mcp/config.ts#L657-L679)
- [print.ts:5446-5479](file://restored-src/src/cli/print.ts#L5446-L5479)

### Agent Runtime and Server Resolution
Agents resolve named MCP servers, connect, and manage lifecycles:
- Lookup server config by name
- Establish connections via bridge/client
- Support per-agent dynamically created servers

```mermaid
sequenceDiagram
participant Agent as "Agent"
participant Config as "Config Resolver"
participant Bridge as "Bridge Client"
participant Srv as "MCP Server"
Agent->>Config : "getMcpConfigByName(name)"
Config-->>Agent : "ScopedMcpServerConfig"
Agent->>Bridge : "connectToServer(name, config)"
Bridge->>Srv : "Connect"
Srv-->>Bridge : "Connected"
Bridge-->>Agent : "Client"
```

**Diagram sources**
- [runAgent.ts:140-177](file://restored-src/src/tools/AgentTool/runAgent.ts#L140-L177)
- [bridgeClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts)

**Section sources**
- [runAgent.ts:140-177](file://restored-src/src/tools/AgentTool/runAgent.ts#L140-L177)

### Browser-Based MCP Bridge
The browser MCP bridge enables extension-backed MCP servers:
- WebSocket bridge client
- MCP server implementation
- Socket client and pool for connection management
- Browser automation tools

```mermaid
graph TB
BC["Bridge Client<br/>bridgeClient.ts"] --> MS["MCP Server<br/>mcpServer.ts"]
BC --> SC["Socket Client<br/>mcpSocketClient.ts"]
BC --> SP["Socket Pool<br/>mcpSocketPool.ts"]
BC --> BT["Browser Tools<br/>browserTools.ts"]
MS --> BT
```

**Diagram sources**
- [bridgeClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts)
- [mcpServer.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts)
- [mcpSocketClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts)
- [browserTools.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts)

**Section sources**
- [bridgeClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts)
- [mcpServer.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts)
- [mcpSocketClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts)
- [mcpSocketPool.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts)
- [browserTools.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts)

### Computer-Use MCP Extensions
Computer-use MCP adds UI automation capabilities:
- Specialized MCP server
- Tools and tool calls for automation
- Supporting utilities for image comparison and sentinel apps

```mermaid
graph TB
CU_Srv["Computer-use MCP Server<br/>computer-mcp mcpServer.ts"] --> CU_Tools["Tools & Calls<br/>computer-mcp toolCalls.ts / tools.ts"]
```

**Diagram sources**
- [computer-mcp mcpServer.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts)
- [computer-mcp toolCalls.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/toolCalls.ts)
- [computer-mcp tools.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts)

**Section sources**
- [computer-mcp mcpServer.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts)
- [computer-mcp toolCalls.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/toolCalls.ts)
- [computer-mcp tools.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts)

## Dependency Analysis
MCP components depend on each other as follows:
- CLI handlers depend on service configuration and agent runtime
- Agent runtime depends on service configuration and bridge client
- MCPTool depends on bridge client for transport
- UI dialogs depend on service configuration for approval/import workflows
- Browser MCP bridge and computer-use MCP are independent extensions that integrate via the bridge client

```mermaid
graph LR
CLI["CLI Handlers<br/>mcp.tsx"] --> SVC["Service Config<br/>config.ts"]
CLI --> AGN["Agent Runtime<br/>runAgent.ts"]
AGN --> BR["Bridge Client<br/>bridgeClient.ts"]
BR --> SRV["MCP Server<br/>mcpServer.ts"]
TOOL["MCPTool<br/>MCPTool.ts"] --> BR
UIA["Approval Dialog<br/>MCPServerApprovalDialog.tsx"] --> SVC
UID["Desktop Import Dialog<br/>MCPServerDesktopImportDialog.tsx"] --> SVC
BR --> BR2["Browser Tools<br/>browserTools.ts"]
BR --> CU["Computer-use MCP<br/>computer-mcp mcpServer.ts"]
BR --> CUT["Computer-use Tools<br/>computer-mcp toolCalls.ts / tools.ts"]
```

**Diagram sources**
- [mcp.tsx:22-210](file://restored-src/src/cli/handlers/mcp.tsx#L22-L210)
- [config.ts:657-679](file://restored-src/src/services/mcp/config.ts#L657-L679)
- [runAgent.ts:140-177](file://restored-src/src/tools/AgentTool/runAgent.ts#L140-L177)
- [bridgeClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts)
- [mcpServer.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts)
- [MCPTool.ts:1-78](file://restored-src/src/tools/MCPTool/MCPTool.ts#L1-L78)
- [MCPServerApprovalDialog.tsx](file://restored-src/src/components/MCPServerApprovalDialog.tsx)
- [MCPServerDesktopImportDialog.tsx](file://restored-src/src/components/MCPServerDesktopImportDialog.tsx)
- [browserTools.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts)
- [computer-mcp mcpServer.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts)
- [computer-mcp toolCalls.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/toolCalls.ts)
- [computer-mcp tools.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts)

**Section sources**
- [mcp.tsx:22-210](file://restored-src/src/cli/handlers/mcp.tsx#L22-L210)
- [config.ts:657-679](file://restored-src/src/services/mcp/config.ts#L657-L679)
- [runAgent.ts:140-177](file://restored-src/src/tools/AgentTool/runAgent.ts#L140-L177)
- [bridgeClient.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/bridgeClient.ts)
- [mcpServer.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/mcpServer.ts)
- [MCPTool.ts:1-78](file://restored-src/src/tools/MCPTool/MCPTool.ts#L1-L78)
- [MCPServerApprovalDialog.tsx](file://restored-src/src/components/MCPServerApprovalDialog.tsx)
- [MCPServerDesktopImportDialog.tsx](file://restored-src/src/components/MCPServerDesktopImportDialog.tsx)
- [browserTools.ts](file://restored-src/node_modules/@ant/claude-for-chrome-mcp/src/browserTools.ts)
- [computer-mcp mcpServer.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/mcpServer.ts)
- [computer-mcp toolCalls.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/toolCalls.ts)
- [computer-mcp tools.ts](file://restored-src/node_modules/@ant/computer-use-mcp/src/tools.ts)

## Performance Considerations
- Connection pooling: The bridge client and socket pool reduce overhead for multiple concurrent requests.
- Output truncation: MCPTool applies truncation checks to avoid oversized results.
- Dynamic reconciliation: Efficiently adds/removes/replaces MCP servers to minimize downtime and redundant connections.
- Browser automation: Browser tools impose limits and constraints to balance responsiveness and accuracy.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Server health checks: Use CLI status commands to detect connection failures or authentication needs.
- Policy violations: Validate configurations against allow/deny lists before adding servers.
- Dynamic server reconciliation: Ensure desired and current states are aligned to avoid stale or conflicting configurations.
- Authentication needs: When connections report authentication requirements, trigger the appropriate approval or import flows.

**Section sources**
- [mcp.tsx:22-210](file://restored-src/src/cli/handlers/mcp.tsx#L22-L210)
- [config.ts:657-679](file://restored-src/src/services/mcp/config.ts#L657-L679)
- [print.ts:5446-5479](file://restored-src/src/cli/print.ts#L5446-L5479)
- [MCPServerApprovalDialog.tsx](file://restored-src/src/components/MCPServerApprovalDialog.tsx)
- [MCPServerDesktopImportDialog.tsx](file://restored-src/src/components/MCPServerDesktopImportDialog.tsx)

## Conclusion
Claude Code’s MCP architecture integrates client-side tools, agent runtime, service configuration, and browser-based bridges to deliver a robust, policy-enforced, and extensible MCP ecosystem. The CLI, service configuration, and UI dialogs streamline server discovery, connection, and governance, while the bridge and computer-use MCP enable advanced automation scenarios. Understanding these components and their interactions helps both users and developers implement reliable MCP integrations.