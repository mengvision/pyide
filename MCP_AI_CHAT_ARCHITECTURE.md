# AI Chat 中 MCP 使用机制详解

## 📊 架构概览

### 核心组件关系图

```
┌──────────────────────────────────────────────────────────────────┐
│                        用户交互层                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ AIChatPanel.tsx                                            │  │
│  │  - 聊天 UI                                                 │  │
│  │  - 模式选择：Chat / Assist / Agent                         │  │
│  │  - ToolConfirmDialog (Assist 模式下确认工具执行)            │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                      聊天逻辑层 (Hook)                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ useChat.ts (hooks/useChat.ts)                              │  │
│  │                                                            │  │
│  │  核心流程：                                                 │  │
│  │  1. sendMessage() - 发送用户消息                           │  │
│  │  2. 构建系统提示 (包含 MCP 工具列表)                       │  │
│  │  3. 调用 AI 获取响应                                       │  │
│  │  4. 解析工具调用 [TOOL_CALL: ...]                         │  │
│  │  5. 执行工具 (仅 Assist/Agent 模式)                        │  │
│  │  6. 将结果返回给 AI                                        │  │
│  │  7. 循环最多 5 轮 (MAX_TOOL_ROUNDS)                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    MCP 桥接层 (Integration)                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ chatIntegration.ts                                         │  │
│  │  (services/MCPService/chatIntegration.ts)                  │  │
│  │                                                            │  │
│  │  职责：                                                     │  │
│  │  - getAvailableToolsForAI()                                │  │
│  │    → 获取所有已连接服务器的工具                             │  │
│  │    → 格式化为 AI 可读的系统提示                             │  │
│  │                                                            │  │
│  │  - processToolCycle()                                      │  │
│  │    → 解析 AI 响应中的工具调用                               │  │
│  │    → 检查权限 (ask/always_allow/always_deny)               │  │
│  │    → 执行工具调用                                           │  │
│  │    → 格式化结果                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    MCP 客户端层 (Client)                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ client.ts                                                  │  │
│  │  (services/MCPService/client.ts)                           │  │
│  │                                                            │  │
│  │  职责：                                                     │  │
│  │  - connectToServer() - 连接 MCP 服务器                     │  │
│  │  - discoverTools() - 自动发现工具 (可能失败)               │  │
│  │  - getKnownDataHubTools() - 手动注册工具 (fallback)        │  │
│  │  - callTool() - 调用工具                                    │  │
│  │                                                            │  │
│  │  关键数据结构：                                             │  │
│  │  - connections: Map<serverName, MCPConnection>             │  │
│  │  - jsonRpcClients: Map<serverName, JSONRPCClient>          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                   JSON-RPC 通信层                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ jsonRpcClient.ts                                           │  │
│  │  (services/MCPService/jsonRpcClient.ts)                    │  │
│  │                                                            │  │
│  │  职责：                                                     │  │
│  │  - sendRequest(method, params) - 发送 JSON-RPC 请求        │  │
│  │  - startListening() - 监听服务器响应                       │  │
│  │  - 消息 ID 管理、超时处理、Promise 封装                     │  │
│  │                                                            │  │
│  │  通信协议：                                                 │  │
│  │  - 发送: JSON.stringify(message) + '\\n'                   │  │
│  │  - 接收: readline() → JSON.parse()                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    Tauri Rust 后端                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ mcp.rs                                                     │  │
│  │  (src-tauri/src/mcp.rs)                                    │  │
│  │                                                            │  │
│  │  职责：                                                     │  │
│  │  - start_mcp_server() - 启动子进程 (uvx)                   │  │
│  │  - send_mcp_message() - 写入 stdin                         │  │
│  │  - read_mcp_message() - 读取 stdout                        │  │
│  │  - stop_mcp_server() - 终止进程                            │  │
│  │                                                            │  │
│  │  进程管理：                                                 │  │
│  │  - MCP_SERVERS: HashMap<name, MCPServerProcess>            │  │
│  │  - 管理 stdin/stdout/stderr 管道                           │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                  DataHub MCP Server                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ uvx mcp-server-datahub@latest                              │  │
│  │                                                            │  │
│  │  提供的工具：                                               │  │
│  │  - search - 搜索数据资产                                    │  │
│  │  - get_lineage - 获取数据血缘                               │  │
│  │  - get_entities - 获取实体元数据                            │  │
│  │  - get_dataset_queries - 获取 SQL 查询示例                  │  │
│  │  - list_schema_fields - 列出 schema 字段                    │  │
│  │  - get_lineage_paths_between - 获取两个资产间的血缘         │  │
│  │  - get_me - 获取当前用户信息                                │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## 🔄 完整的工具调用流程

### 时序图

```
用户                      AIChatPanel                useChat              mcpChatIntegration      mcpClient              JSONRPCClient           DataHub MCP
 |                           |                         |                        |                     |                       |                  |
 |--"搜索外呼次数字段"------->|                         |                        |                     |                       |                  |
 |                           |--sendMessage()--------->|                        |                     |                       |                  |
 |                           |                         |--getAvailableToolsForAI()------------------->|                       |                  |
 |                           |                         |                        |--getConnections()-->|                       |                  |
 |                           |                         |                        |<--工具列表(7个)------|                       |                  |
 |                           |                         |<--工具描述文本---------|                       |                       |                  |
 |                           |                         |--构建系统提示(含工具)  |                     |                       |                  |
 |                           |                         |--ChatEngine.sendMessage()                      |                       |                  |
 |                           |                         |----------------------->AI API                 |                       |                  |
 |                           |                         |<--AI 流式响应----------|                       |                       |                  |
 |                           |<--更新 UI (流式)--------|                        |                     |                       |                  |
 |                           |                         |--processToolCycle()-->|                       |                       |                  |
 |                           |                         |                        |--parseToolCalls()    |                       |                  |
 |                           |                         |                        |-->检测到 TOOL_CALL   |                       |                  |
 |                           |                         |                        |--executeToolCall()-->|                       |                  |
 |                           |                         |                        |                       |--callTool()---------->|                  |
 |                           |                         |                        |                       |                       |--sendRequest()-->|
 |                           |                         |                        |                       |                       |---[tools/call]--->|
 |                           |                         |                        |                       |                       |                  |--(处理中)
 |                           |                         |                        |                       |                       |<--[超时/错误]----|
 |                           |                         |                        |                       |<--Error: Timeout------|                  |
 |                           |                         |                        |<--执行结果(错误)------|                       |                  |
 |                           |                         |<--toolResults----------|                       |                       |                  |
 |                           |                         |--继续下一轮(如有)      |                     |                       |                  |
 |                           |                         |--最终响应--------------|                       |                       |                  |
 |<--显示结果----------------|                         |                        |                     |                       |                  |
```

## 💡 AI Chat 何时使用 MCP？

### 触发条件

**必须同时满足以下条件**：

1. ✅ **聊天模式**：`chatMode === 'assist' || chatMode === 'agent'`
2. ✅ **有已连接的 MCP 服务器**：`mcpClient.getAllConnections()` 返回非空
3. ✅ **AI 识别到需要调用工具**：AI 响应中包含 `[TOOL_CALL: server.tool({...})]`

### 三种模式的区别

| 模式 | 工具注入到系统提示 | AI 调用工具 | 实际执行工具 | 用户确认 |
|------|-------------------|------------|-------------|---------|
| **Chat** | ❌ 不注入 | ❌ 不会调用 | ❌ 不执行 | N/A |
| **Assist** | ✅ 注入 | ✅ 可以调用 | ⚠️ 只读自动执行，写操作需确认 | ✅ 需要 |
| **Agent** | ✅ 注入 | ✅ 可以调用 | ✅ 全自动执行 | ❌ 不需要 |

### 代码中的关键判断

```typescript
// hooks/useChat.ts - 第 92-96 行
// Append MCP tools description if in Assist or Agent mode
let mcpToolsContext = '';
if (chatMode === 'assist' || chatMode === 'agent') {
  mcpToolsContext = await mcpChatIntegration.getAvailableToolsForAI();
}

// hooks/useChat.ts - 第 158 行
// Parse tool calls from AI response (only in Assist/Agent modes)
if ((chatMode === 'assist' || chatMode === 'agent') && round < MAX_TOOL_ROUNDS) {
  const { hasToolCalls, toolResults, cleanResponse } =
    await mcpChatIntegration.processToolCycle(fullContent, chatMode, onConfirm);
  // ...
}
```

## 🎯 MCP 初始化时机

### 当前实现（有问题）

**问题**：MCP 只在点击 MCP Panel 时才初始化！

```typescript
// MCPPanel.tsx - 只有这个组件挂载时才初始化
useEffect(() => {
  initializeMCP();  // ← 调用 connectToServer()
}, []);
```

这导致：
- ❌ 不打开 MCP Panel → 服务器未连接 → AI Chat 无法使用工具
- ❌ 重复打开 MCP Panel → 重复连接 → "Server already running" 错误

### 正确的架构

MCP 应该在**应用启动时**就初始化，而不是在组件挂载时。

**建议的修复方案**：

```typescript
// App.tsx - 在应用启动时初始化 MCP
useEffect(() => {
  initSettingsPlatform(platform);
  initSkillPlatform(platform);
  mcpClient.setPlatform(platform);
  
  // 添加这一行：启动时自动连接 MCP 服务器
  initializeMCPServers(platform);
  
}, [platform]);

// 新增：独立的 MCP 初始化函数
async function initializeMCPServers(platform: PlatformService) {
  try {
    const config = await loadMCPConfig(platform);
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      await mcpClient.connectToServer(name, serverConfig);
    }
    console.log('[App] MCP servers initialized');
  } catch (error) {
    console.error('[App] Failed to initialize MCP servers:', error);
  }
}
```

## 🐛 当前存在的问题

### 问题 1: DataHub 不响应 JSON-RPC

**日志**：
```
Failed to call tool search on datahub: Error: Request timeout: tools/call (id: 2)
```

**原因**：DataHub MCP Server 可能使用 HTTP/SSE 传输，而不是纯 stdio JSON-RPC。

**解决方案**：
1. 使用 `mcp-remote` 代理（临时方案）
2. 实现 HTTP/SSE 传输支持（根本解决）
3. 对于只读工具，可以直接调用 DataHub REST API（绕过 MCP）

### 问题 2: 重复初始化

**日志**：
```
[MCP] Starting initialization... (多次)
[MCPClient] Failed to connect to MCP server datahub: Server datahub already running
```

**原因**：React StrictMode 导致 useEffect 执行两次。

**解决方案**：已添加 `initializedRef` 防止重复初始化。

### 问题 3: 工具发现超时

**日志**：
```
[MCPClient] Tool discovery timeout for datahub, using fallback
```

**解决方案**：已实现 5 秒超时 + 手动注册 fallback。

## 📝 关键代码位置

### 1. 聊天模式判断
- **文件**：`hooks/useChat.ts`
- **行号**：92-96, 158
- **作用**：决定何时注入工具、何时执行工具

### 2. 工具列表获取
- **文件**：`services/MCPService/chatIntegration.ts`
- **函数**：`getAvailableToolsForAI()`
- **作用**：将工具列表格式化为 AI 可读的文本

### 3. 工具调用解析
- **文件**：`utils/toolCallParser.ts`
- **函数**：`parseToolCalls()`
- **正则**：`/\[TOOL_CALL:\s*(\w+)\.(\w+)\((\{[\s\S]*?\})\)\]/g`

### 4. 工具执行
- **文件**：`services/MCPService/client.ts`
- **函数**：`callTool()`
- **流程**：通过 JSONRPCClient 发送 `tools/call` 请求

### 5. 权限检查
- **文件**：`services/MCPService/permissions.ts`
- **函数**：`checkPermission()`
- **存储**：localStorage 中的 `mcp_permissions`

## 🚀 改进建议

### 短期（立即可做）

1. **应用启动时初始化 MCP**
   - 在 App.tsx 中添加 MCP 初始化
   - 移除 MCPPanel 中的初始化逻辑

2. **添加 MCP 状态管理**
   - 使用 Zustand store 管理 MCP 连接状态
   - 避免重复连接

3. **优化错误处理**
   - 工具调用失败时给出明确提示
   - 区分"连接失败"和"工具执行失败"

### 中期

4. **实现 DataHub REST API 直连**
   - 不通过 MCP，直接调用 DataHub API
   - 更可靠，性能更好

5. **支持 HTTP/SSE 传输**
   - 扩展 JSONRPCClient 支持 HTTP
   - 兼容更多 MCP Server

### 长期

6. **MCP Server 选择器**
   - 让用户在 AI Chat 中选择使用哪些 MCP Server
   - 动态启用/禁用工具

7. **工具调用历史**
   - 记录所有工具调用
   - 方便调试和审计

---

## 📚 相关文档

- [MCP_AI_CHAT_FIX_COMPLETED.md](MCP_AI_CHAT_FIX_COMPLETED.md) - 修复总结
- [MCP_LOADING_FIX.md](MCP_LOADING_FIX.md) - Loading 问题修复
- [DATAHUB_AI_CHAT_GUIDE.md](DATAHUB_AI_CHAT_GUIDE.md) - 使用指南
