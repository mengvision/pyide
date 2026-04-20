# 🔧 MCP Panel 卡在 Loading 问题修复

## 问题症状
- MCP Panel 一直显示 "Loading MCP servers..."
- AI Chat 中无法使用 DataHub 工具

## 根本原因
`discoverTools()` 调用在等待 JSON-RPC 响应时无限期卡住，因为 DataHub MCP Server 不响应 tools/list 请求。

## 修复内容

### 1. 添加超时保护 (client.ts)

```typescript
// 添加 5 秒超时，防止无限等待
tools = await Promise.race([
  this.discoverTools(serverName),
  new Promise<MCPTool[]>((resolve) => 
    setTimeout(() => {
      console.warn(`[MCPClient] Tool discovery timeout for ${serverName}, using fallback`);
      resolve([]);
    }, 5000) // 5 second timeout
  )
]);
```

### 2. 增强日志输出 (MCPPanel.tsx + client.ts)

添加了详细的日志，可以在浏览器控制台看到每一步的执行情况：
- `[MCP] Starting initialization...`
- `[MCP] Config loaded: ...`
- `[MCP] Connecting to server: datahub`
- `[MCPClient] Starting server: datahub`
- `[MCPClient] Server process started: datahub`
- `[MCPClient] Listening started: datahub`
- `[MCPClient] Discovering tools for: datahub`
- `[MCPClient] Tool discovery timeout for datahub, using fallback`
- `[MCPClient] Tool discovery returned empty, using manual tool registration for DataHub`
- `[MCPClient] Server datahub connected with 7 tools`
- `[MCP] Initialization complete, setting loading=false`

## 🚀 如何测试修复

### 1. 重启 PyIDE

```bash
# 关闭当前运行的 PyIDE
# 重新启动
cd c:\Users\mengshiquan\Desktop\test1\pyide\apps\desktop
npm run tauri dev
```

### 2. 打开浏览器开发者工具

按 **F12** 打开开发者工具，切换到 **Console** 标签。

### 3. 查看 MCP Panel

打开侧边栏的 MCP Servers 面板，你应该看到：
1. 不再显示 "Loading MCP servers..."
2. 显示 datahub 服务器卡片
3. 状态为 "connected"
4. 显示 **Available Tools (7)**

### 4. 检查控制台日志

在控制台中应该看到类似这样的日志：

```
[MCP] Starting initialization...
[MCP] Config loaded: {mcpServers: {...}}
[MCP] Connecting to server: datahub
[MCPClient] Starting server: datahub
[MCPClient] Server process started: datahub
[MCPClient] Listening started: datahub
[MCPClient] Discovering tools for: datahub
[MCPClient] Tool discovery timeout for datahub, using fallback
[MCPClient] Tool discovery returned empty, using manual tool registration for DataHub
[MCPClient] Server datahub connected with 7 tools
[MCP] All connections: [{serverName: 'datahub', status: 'connected', tools: [...]}]
[MCP] Initialization complete, setting loading=false
```

### 5. 测试 AI Chat

1. 切换到 AI Chat 面板
2. 选择 **Assist 模式**
3. 提问：**"datahub 里边有没有关于外呼次数的字段"**

AI 应该会：
1. 识别需要搜索 DataHub
2. 输出：`[TOOL_CALL: datahub.search({"query": "外呼次数"})]`
3. 执行工具调用
4. 返回搜索结果

## 🐛 如果仍然卡住

### 检查点 1: 配置文件

```powershell
# 检查配置文件是否存在
Test-Path $env:USERPROFILE\.pyide\mcp_config.json

# 查看配置内容
Get-Content $env:USERPROFILE\.pyide\mcp_config.json
```

应该看到：
```json
{
  "mcpServers": {
    "datahub": {
      "command": "uvx",
      "args": ["mcp-server-datahub@latest"],
      "env": {
        "DATAHUB_GMS_URL": "http://192.168.38.121:8080",
        "DATAHUB_GMS_TOKEN": "your-token"
      }
    }
  }
}
```

### 检查点 2: uvx 是否可用

```powershell
uvx --version
```

应该显示版本号，如 `uvx 0.11.3`

### 检查点 3: 查看错误日志

如果控制台显示错误，检查：
- `[MCPClient] Failed to connect` - 说明启动 MCP 服务器失败
- `[MCP] Failed to initialize MCP` - 说明配置加载或其他步骤失败

### 检查点 4: 手动测试 DataHub MCP

```bash
cd c:\Users\mengshiquan\Desktop\test1\pyide
python test_mcp_simple.py
```

## 📊 预期行为

### MCP Panel 显示

```
┌─────────────────────────────────┐
│ MCP Servers                     │
├─────────────────────────────────┤
│ datahub               [✓] [✕]  │
│ connected                       │
│                                 │
│ Available Tools (7)             │
│ • search                        │
│ • get_lineage                   │
│ • get_dataset_queries           │
│ • get_entities                  │
│ • list_schema_fields            │
│ • get_lineage_paths_between     │
│ • get_me                        │
└─────────────────────────────────┘
```

### AI Chat 工具调用

用户问：**"搜索包含 revenue 的表"**

AI 回复：
```
让我帮你搜索 DataHub 中包含 revenue 的数据表。

[TOOL_CALL: datahub.search({"query": "revenue*"})]

根据搜索结果，我找到了以下相关表：
1. sales_revenue (生产数据库)
2. revenue_forecast (数据仓库)
3. monthly_revenue_report (报表系统)
...
```

## ✅ 修复验证清单

- [ ] MCP Panel 不再显示 "Loading..."
- [ ] datahub 服务器显示为 "connected"
- [ ] 显示 7 个可用工具
- [ ] 控制台有完整的日志输出
- [ ] AI Chat Assist 模式下可以调用工具
- [ ] 工具调用返回实际数据

## 📝 技术细节

### 超时机制

```typescript
Promise.race([
  this.discoverTools(serverName),  // 正常发现流程
  new Promise((resolve) =>         // 5秒超时
    setTimeout(() => resolve([]), 5000)
  )
])
```

这确保了即使 `discoverTools()` 永远不返回，也会在 5 秒后超时并继续执行 fallback 逻辑。

### Fallback 逻辑

```typescript
if (tools.length === 0 && serverName === 'datahub') {
  tools = this.getKnownDataHubTools();  // 使用手动注册的工具
}
```

当工具发现失败时，使用预定义的 DataHub 工具列表。

---

**现在重启 PyIDE 试试吧！** 🎉
