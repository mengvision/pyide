# MCP Server Management

<cite>
**Referenced Files in This Document**
- [client.ts](file://src/services/mcp/client.ts)
- [config.ts](file://src/services/mcp/config.ts)
- [auth.ts](file://src/services/mcp/auth.ts)
- [types.ts](file://src/services/mcp/types.ts)
- [useManageMCPConnections.ts](file://src/services/mcp/useManageMCPConnections.ts)
- [addCommand.ts](file://src/commands/mcp/addCommand.ts)
- [index.ts](file://src/commands/mcp/index.ts)
- [print.ts](file://src/cli/print.ts)
- [main.tsx](file://src/main.tsx)
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
This document provides comprehensive guidance for managing MCP (Model Context Protocol) servers within the Claude Code ecosystem. It covers server configuration, connection handling, lifecycle management, authentication, discovery, capability negotiation, channel management, approval workflows, permissions, allowlist configurations, performance optimization, and troubleshooting. The goal is to equip both developers and operators with practical knowledge to deploy, monitor, and maintain MCP servers effectively.

## Project Structure
The MCP server management system spans several modules:
- Services: Core connection logic, configuration parsing, authentication, and UI lifecycle management
- Commands: CLI commands for adding and managing MCP servers
- Types: Strongly typed configuration and connection schemas
- CLI: Control plane integration for dynamic server reconciliation

```mermaid
graph TB
subgraph "CLI Layer"
CMD["mcp add command"]
PRINT["CLI Control Plane"]
end
subgraph "Services"
CFG["MCP Config Manager"]
CONN["MCP Client"]
AUTH["MCP Auth Provider"]
LIFE["Connection Lifecycle"]
end
subgraph "MCP Servers"
STDIO["Local stdio server"]
HTTP["HTTP server"]
SSE["SSE server"]
WS["WebSocket server"]
SDK["SDK in-process server"]
end
CMD --> CFG
PRINT --> LIFE
CFG --> CONN
AUTH --> CONN
CONN --> STDIO
CONN --> HTTP
CONN --> SSE
CONN --> WS
CONN --> SDK
LIFE --> SSE
LIFE --> HTTP
```

**Diagram sources**
- [addCommand.ts:1-281](file://src/commands/mcp/addCommand.ts#L1-281)
- [config.ts:1-800](file://src/services/mcp/config.ts#L1-800)
- [client.ts:1-800](file://src/services/mcp/client.ts#L1-800)
- [auth.ts:1-800](file://src/services/mcp/auth.ts#L1-800)
- [useManageMCPConnections.ts:1-800](file://src/services/mcp/useManageMCPConnections.ts#L1-800)

**Section sources**
- [addCommand.ts:1-281](file://src/commands/mcp/addCommand.ts#L1-281)
- [config.ts:1-800](file://src/services/mcp/config.ts#L1-800)
- [client.ts:1-800](file://src/services/mcp/client.ts#L1-800)
- [auth.ts:1-800](file://src/services/mcp/auth.ts#L1-800)
- [useManageMCPConnections.ts:1-800](file://src/services/mcp/useManageMCPConnections.ts#L1-800)

## Core Components
- MCP Client: Establishes and maintains connections across transports (stdio, SSE, HTTP, WebSocket, SDK), manages timeouts, retries, and error handling
- Configuration Manager: Validates, expands environment variables, filters by policy, and persists server configurations
- Authentication Provider: Handles OAuth discovery, token refresh, cross-app access (XAA), and secure token storage
- Connection Lifecycle: Orchestrates connection attempts, automatic reconnection with exponential backoff, capability negotiation, and notification subscriptions
- CLI Integration: Adds servers, reconciles dynamic configurations, and integrates with the control plane

**Section sources**
- [client.ts:595-1641](file://src/services/mcp/client.ts#L595-1641)
- [config.ts:536-761](file://src/services/mcp/config.ts#L536-761)
- [auth.ts:256-311](file://src/services/mcp/auth.ts#L256-311)
- [useManageMCPConnections.ts:310-763](file://src/services/mcp/useManageMCPConnections.ts#L310-763)

## Architecture Overview
The MCP system follows a layered architecture:
- Transport Abstraction: Unified client connects via stdio, SSE, HTTP, WebSocket, or SDK transports
- Capability Negotiation: Clients declare capabilities and react to server capabilities
- Policy Enforcement: Allow/deny lists and enterprise policies govern server availability
- Authentication Pipeline: Discovery, token refresh, and XAA flows
- Lifecycle Management: Automatic reconnection, cache invalidation, and state synchronization

```mermaid
sequenceDiagram
participant CLI as "CLI"
participant CFG as "Config Manager"
participant AUTH as "Auth Provider"
participant CLIENT as "MCP Client"
participant SERVER as "MCP Server"
CLI->>CFG : Add/Update server config
CFG-->>CLI : Validation result
CLI->>CLIENT : connectToServer(name, config)
CLIENT->>AUTH : Discover OAuth metadata
AUTH-->>CLIENT : Tokens/Discovery state
CLIENT->>SERVER : Connect (transport-specific)
SERVER-->>CLIENT : Capabilities + Instructions
CLIENT-->>CLI : Connection result (connected/failed/needs-auth)
CLI->>CLIENT : Periodic reconnection (exponential backoff)
```

**Diagram sources**
- [client.ts:595-1641](file://src/services/mcp/client.ts#L595-1641)
- [auth.ts:256-311](file://src/services/mcp/auth.ts#L256-311)
- [config.ts:536-761](file://src/services/mcp/config.ts#L536-761)
- [useManageMCPConnections.ts:354-467](file://src/services/mcp/useManageMCPConnections.ts#L354-467)

## Detailed Component Analysis

### Server Configuration and Setup
- Configuration scopes: local, user, project, dynamic, enterprise, claudeai, managed
- Supported transports: stdio, SSE, SSE-IDE, HTTP, WebSocket, SDK, claude.ai proxy
- Schema validation and environment expansion
- Policy filtering: allowlist/denylist enforcement with name/command/URL patterns
- Enterprise MCP configuration precedence

```mermaid
flowchart TD
Start(["Add MCP Server"]) --> Scope["Select scope (local/user/project)"]
Scope --> Transport{"Transport type?"}
Transport --> |stdio| Stdio["Build stdio config<br/>command + args + env"]
Transport --> |sse/http/ws| Remote["Build remote config<br/>url + headers + oauth"]
Transport --> |sdk| SDK["Build SDK config<br/>name + type"]
Transport --> |claudeai-proxy| Proxy["Build proxy config<br/>id + url"]
Stdio --> Validate["Validate schema"]
Remote --> Validate
SDK --> Validate
Proxy --> Validate
Validate --> Policy["Apply allow/deny list"]
Policy --> Persist["Persist to .mcp.json or settings"]
Persist --> End(["Server ready"])
```

**Diagram sources**
- [addCommand.ts:33-281](file://src/commands/mcp/addCommand.ts#L33-281)
- [config.ts:536-761](file://src/services/mcp/config.ts#L536-761)
- [types.ts:108-175](file://src/services/mcp/types.ts#L108-175)

**Section sources**
- [addCommand.ts:33-281](file://src/commands/mcp/addCommand.ts#L33-281)
- [config.ts:536-761](file://src/services/mcp/config.ts#L536-761)
- [types.ts:108-175](file://src/services/mcp/types.ts#L108-175)

### Connection Handling and Lifecycle Management
- Transport selection and initialization
- Connection timeouts and transport-specific behaviors
- Automatic reconnection with exponential backoff for remote transports
- Cache invalidation and memoization for efficient reconnects
- Capability negotiation and notification subscriptions
- IDE-specific transports and in-process server execution

```mermaid
sequenceDiagram
participant UI as "UI/CLI"
participant LIFE as "Lifecycle Manager"
participant CLIENT as "MCP Client"
participant CACHE as "Memoization Cache"
UI->>LIFE : Initialize servers
LIFE->>CLIENT : connectToServer(name, config)
CLIENT->>CACHE : Check cache key
alt Cache hit
CACHE-->>CLIENT : Return cached client
else Cache miss
CLIENT->>CLIENT : Establish transport connection
CLIENT-->>LIFE : Connection result
end
LIFE->>CLIENT : Register handlers (onclose/onerror)
CLIENT-->>LIFE : onclose fired
LIFE->>CACHE : Clear cache
LIFE->>LIFE : Schedule exponential backoff reconnect
LIFE->>CLIENT : reconnectMcpServerImpl
CLIENT-->>LIFE : New connection or failed
```

**Diagram sources**
- [client.ts:595-1641](file://src/services/mcp/client.ts#L595-1641)
- [useManageMCPConnections.ts:333-467](file://src/services/mcp/useManageMCPConnections.ts#L333-467)

**Section sources**
- [client.ts:595-1641](file://src/services/mcp/client.ts#L595-1641)
- [useManageMCPConnections.ts:333-467](file://src/services/mcp/useManageMCPConnections.ts#L333-467)

### Authentication Methods and Discovery
- OAuth metadata discovery via RFC 9728 → RFC 8414
- Token refresh with robust error handling and normalization
- Cross-app access (XAA) for shared identity across servers
- Secure token storage and revocation
- Step-up authentication and discovery state preservation

```mermaid
flowchart TD
A["Connection attempt"] --> B["Discover OAuth metadata"]
B --> C{"Metadata available?"}
C --> |Yes| D["Fetch tokens via auth provider"]
C --> |No| E["Fallback discovery path"]
D --> F{"Token valid?"}
F --> |Yes| G["Proceed with authenticated request"]
F --> |No| H["Refresh token or prompt auth"]
H --> I{"Refresh success?"}
I --> |Yes| G
I --> |No| J["Mark needs-auth and cache"]
```

**Diagram sources**
- [auth.ts:256-311](file://src/services/mcp/auth.ts#L256-311)
- [client.ts:340-361](file://src/services/mcp/client.ts#L340-361)

**Section sources**
- [auth.ts:256-311](file://src/services/mcp/auth.ts#L256-311)
- [client.ts:340-361](file://src/services/mcp/client.ts#L340-361)

### Capability Negotiation and Channel Management
- Capability negotiation during connection
- Notification subscriptions for tools, prompts, and resources
- Channel permission gating and messaging
- Dynamic reconciliation of MCP servers in the control plane

```mermaid
classDiagram
class MCPClient {
+connect(transport)
+setRequestHandler()
+setNotificationHandler()
+onclose()
+onerror()
}
class Capability {
+tools
+prompts
+resources
+experimental
}
class ChannelGate {
+gateChannelServer()
+register()
+skip()
}
MCPClient --> Capability : "negotiates"
MCPClient --> ChannelGate : "uses"
```

**Diagram sources**
- [client.ts:985-1002](file://src/services/mcp/client.ts#L985-1002)
- [useManageMCPConnections.ts:474-561](file://src/services/mcp/useManageMCPConnections.ts#L474-561)

**Section sources**
- [client.ts:985-1002](file://src/services/mcp/client.ts#L985-1002)
- [useManageMCPConnections.ts:474-561](file://src/services/mcp/useManageMCPConnections.ts#L474-561)

### Server Approval Workflows and Permissions
- Allow/deny list enforcement with name/command/URL patterns
- Enterprise MCP configuration precedence
- Policy filtering for user-controlled and plugin-provided servers
- Permission callbacks for channel interactions

```mermaid
flowchart TD
Start(["Server config loaded"]) --> Policy["Filter by policy"]
Policy --> Allowed{"Allowed?"}
Allowed --> |Yes| Connect["Connect to server"]
Allowed --> |No| Block["Block with reason"]
Connect --> Gate["Channel permission gate"]
Gate --> Approved{"Approved?"}
Approved --> |Yes| Enable["Enable server"]
Approved --> |No| Deny["Deny with reason"]
```

**Diagram sources**
- [config.ts:536-551](file://src/services/mcp/config.ts#L536-551)
- [useManageMCPConnections.ts:474-613](file://src/services/mcp/useManageMCPConnections.ts#L474-613)

**Section sources**
- [config.ts:536-551](file://src/services/mcp/config.ts#L536-551)
- [useManageMCPConnections.ts:474-613](file://src/services/mcp/useManageMCPConnections.ts#L474-613)

### Practical Configuration Examples
- Adding an HTTP server with headers and OAuth client ID
- Adding a stdio server with environment variables
- Enabling XAA for cross-application access
- Managing server scope (local/user/project)

Example paths:
- [Add HTTP server:193-238](file://src/commands/mcp/addCommand.ts#L193-238)
- [Add stdio server:251-274](file://src/commands/mcp/addCommand.ts#L251-274)
- [XAA setup validation:103-122](file://src/commands/mcp/addCommand.ts#L103-122)

**Section sources**
- [addCommand.ts:193-238](file://src/commands/mcp/addCommand.ts#L193-238)
- [addCommand.ts:251-274](file://src/commands/mcp/addCommand.ts#L251-274)
- [addCommand.ts:103-122](file://src/commands/mcp/addCommand.ts#L103-122)

### Dynamic Server Reconciliation
- Control plane integration for dynamic server management
- Reconciliation of desired vs. current state
- Handling additions, removals, and config changes

```mermaid
sequenceDiagram
participant CP as "Control Plane"
participant RECON as "Reconcile Function"
participant CFG as "Config Manager"
participant LIFE as "Lifecycle Manager"
CP->>RECON : Desired configs
RECON->>CFG : Compare with current configs
CFG-->>RECON : Differences (add/remove/replace)
RECON->>LIFE : Apply changes (connect/disconnect)
LIFE-->>CP : Updated state
```

**Diagram sources**
- [print.ts:5446-5478](file://src/cli/print.ts#L5446-5478)
- [config.ts:536-551](file://src/services/mcp/config.ts#L536-551)

**Section sources**
- [print.ts:5446-5478](file://src/cli/print.ts#L5446-5478)
- [config.ts:536-551](file://src/services/mcp/config.ts#L536-551)

## Dependency Analysis
Key dependencies and relationships:
- Client depends on auth provider for OAuth flows
- Lifecycle manager orchestrates client connections and reconnections
- Config manager validates and filters server configurations
- CLI commands integrate with both config and lifecycle managers

```mermaid
graph TB
CLIENT["MCP Client"] --> AUTH["Auth Provider"]
LIFE["Lifecycle Manager"] --> CLIENT
LIFE --> CFG["Config Manager"]
CMD["CLI Commands"] --> CFG
CMD --> LIFE
PRINT["Control Plane"] --> LIFE
```

**Diagram sources**
- [client.ts:595-1641](file://src/services/mcp/client.ts#L595-1641)
- [auth.ts:256-311](file://src/services/mcp/auth.ts#L256-311)
- [useManageMCPConnections.ts:310-763](file://src/services/mcp/useManageMCPConnections.ts#L310-763)
- [addCommand.ts:33-281](file://src/commands/mcp/addCommand.ts#L33-281)

**Section sources**
- [client.ts:595-1641](file://src/services/mcp/client.ts#L595-1641)
- [auth.ts:256-311](file://src/services/mcp/auth.ts#L256-311)
- [useManageMCPConnections.ts:310-763](file://src/services/mcp/useManageMCPConnections.ts#L310-763)
- [addCommand.ts:33-281](file://src/commands/mcp/addCommand.ts#L33-281)

## Performance Considerations
- Connection batching: Separate concurrency limits for local (stdio/sdk) and remote transports
- Memoization: Client and fetch caches reduce redundant connections and metadata queries
- Timeout strategies: Transport-specific timeouts and connection timeouts prevent hangs
- Backoff: Exponential backoff for reconnection reduces server load and improves resilience
- Resource limits: LRU caches for fetched tools/prompts/resources bound memory usage

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Connection timeouts: Verify transport configuration, network connectivity, and proxy settings
- Authentication failures: Check OAuth metadata discovery, token validity, and XAA configuration
- Session expiration: Look for 404 with JSON-RPC -32001 and rely on automatic session recovery
- Policy denials: Review allow/deny list entries and enterprise MCP configuration
- IDE transport issues: Confirm IDE-specific headers and token requirements

Diagnostic references:
- [Connection timeout handling:1048-1080](file://src/services/mcp/client.ts#L1048-1080)
- [Authentication failure handling:1105-1154](file://src/services/mcp/client.ts#L1105-1154)
- [Session expiration detection:1313-1329](file://src/services/mcp/client.ts#L1313-1329)
- [Policy filtering:536-551](file://src/services/mcp/config.ts#L536-551)
- [IDE transport handling:1199-1214](file://src/services/mcp/client.ts#L1199-1214)

**Section sources**
- [client.ts:1048-1080](file://src/services/mcp/client.ts#L1048-1080)
- [client.ts:1105-1154](file://src/services/mcp/client.ts#L1105-1154)
- [client.ts:1313-1329](file://src/services/mcp/client.ts#L1313-1329)
- [config.ts:536-551](file://src/services/mcp/config.ts#L536-551)
- [client.ts:1199-1214](file://src/services/mcp/client.ts#L1199-1214)

## Conclusion
The MCP server management system provides a robust, policy-aware framework for connecting to diverse MCP servers with strong authentication, capability negotiation, and resilient lifecycle management. By leveraging configuration scoping, policy enforcement, and automated reconnection strategies, teams can reliably operate MCP integrations across development and enterprise environments.