# PyIDE AI Chat 中使用 DataHub MCP 完整指南

## 📋 前置条件

### 1. MCP 配置已就绪

你的 MCP 配置文件位于：
- **Qoder 配置**: `C:\Users\mengshiquan\AppData\Roaming\Qoder\SharedClientCache\mcp.json`
- **PyIDE 配置**: `C:\Users\mengshiquan\.pyide\mcp_config.json`

配置内容：
```json
{
  "mcpServers": {
    "datahub": {
      "command": "uvx",
      "args": ["mcp-server-datahub@latest"],
      "env": {
        "DATAHUB_GMS_URL": "http://192.168.38.121:8080/",
        "DATAHUB_GMS_TOKEN": "eyJhbGciOiJIUzI1NiJ9..."
      }
    }
  }
}
```

### 2. PyIDE MCP 集成架构

PyIDE 已经实现了完整的 MCP 集成架构：

```
用户对话 → AI Chat → MCPClient → DataHub MCP Server → DataHub GMS
                ↓
          工具发现 & 执行
                ↓
          结果返回给 AI
```

## 🚀 在 AI Chat 中使用 DataHub

### 步骤 1: 启动 PyIDE 桌面端

```bash
cd c:\Users\mengshiquan\Desktop\test1\pyide\apps\desktop
# 使用 Tauri 开发模式
npm run tauri dev

# 或者生产模式
npm run tauri build
```

### 步骤 2: 确认 MCP 服务器连接

PyIDE 启动时会自动：
1. 读取 `~/.pyide/mcp_config.json` 配置文件
2. 启动配置的 MCP 服务器（datahub）
3. 通过 JSON-RPC 进行 initialize 握手
4. 发现可用的工具列表

你可以在侧边栏的 **MCP Servers** 面板中查看连接状态。

### 步骤 3: 切换到合适的聊天模式

PyIDE AI Chat 提供三种模式：

| 模式 | 说明 | DataHub 工具执行 |
|------|------|-----------------|
| **Chat** | 纯对话模式 | ❌ 不执行工具，仅展示可用工具列表 |
| **Assist** | 辅助模式 | ⚠️ 只读工具自动执行，写入工具需确认 |
| **Agent** | 智能体模式 | ✅ 自动执行所有工具 |

**推荐使用**：
- **Assist 模式**：适合探索 DataHub 数据，安全的只读操作
- **Agent 模式**：适合批量操作，如批量添加标签、更新描述等

### 步骤 4: 与 DataHub 对话示例

#### 示例 1: 搜索数据资产（只读）

```
用户: "帮我搜索包含 'revenue' 的数据表"

AI 会自动:
1. 识别需要调用 datahub.search 工具
2. 执行工具调用：[TOOL_CALL: datahub.search({"query": "revenue_*"})]
3. 获取搜索结果
4. 基于结果生成回答
```

#### 示例 2: 查看数据血缘

```
用户: "显示用户表的下游依赖"

AI 会自动:
1. 先搜索获取用户表的 URN
2. 调用 datahub.get_lineage 工具
3. 分析血缘关系
4. 生成可视化描述
```

#### 示例 3: 更新数据描述（需要确认）

```
用户: "更新 sales_table 的描述为 '2024年销售数据'"

在 Assist 模式下:
1. AI 识别需要调用 datahub.update_description
2. 弹出确认对话框：
   ┌─────────────────────────────────────┐
   │  允许执行此工具？                    │
   │  服务器: datahub                    │
   │  工具: update_description           │
   │  参数: {                            │
   │    "urn": "urn:li:dataset:...",    │
   │    "description": "2024年销售数据"  │
   │  }                                  │
   │                                     │
   │  [允许] [拒绝] [始终允许]           │
   └─────────────────────────────────────┘
3. 用户确认后执行
```

## 🛠️ DataHub 可用工具列表

根据 DataHub MCP Server v2.14.7，以下工具可用：

### 搜索与发现
- **search**: 搜索 DataHub 中的数据资产
- **get_entities**: 批量获取实体元数据
- **list_schema_fields**: 列出数据集的 schema 字段

### 血缘分析
- **get_lineage**: 获取上游/下游血缘关系
- **get_lineage_paths_between**: 获取两个资产之间的血缘路径

### 查询分析
- **get_dataset_queries**: 获取引用数据集的真实 SQL 查询

### 用户信息
- **get_me**: 获取当前认证用户信息

### 文档工具
- **search_documents**: 搜索文档
- **grep_documents**: 在文档内容中搜索
- **save_document**: 保存文档到 DataHub

### 修改工具（需启用）
需要设置环境变量 `TOOLS_IS_MUTATION_ENABLED=true`：
- **add_tags / remove_tags**: 添加/删除标签
- **add_terms / remove_terms**: 添加/删除术语
- **add_owners / remove_owners**: 添加/删除所有者
- **set_domains / remove_domains**: 设置/移除域
- **update_description**: 更新描述
- **add_structured_properties / remove_structured_properties**: 管理结构化属性

## ⚙️ 启用修改工具

如果你需要使用修改工具（写操作），需要更新配置：

```json
{
  "mcpServers": {
    "datahub": {
      "command": "uvx",
      "args": ["mcp-server-datahub@latest"],
      "env": {
        "DATAHUB_GMS_URL": "http://192.168.38.121:8080/",
        "DATAHUB_GMS_TOKEN": "eyJhbGciOiJIUzI1NiJ9...",
        "TOOLS_IS_MUTATION_ENABLED": "true",
        "TOOLS_IS_USER_ENABLED": "true"
      }
    }
  }
}
```

## 🔧 故障排查

### 问题 1: MCP 服务器未连接

**症状**: MCP Panel 显示 "No MCP servers configured" 或 "error" 状态

**解决方案**:
1. 检查配置文件是否存在：`Test-Path $env:USERPROFILE\.pyide\mcp_config.json`
2. 检查 uvx 是否安装：`uvx --version`
3. 测试 DataHub GMS 连接：
   ```powershell
   Invoke-WebRequest -Uri http://192.168.38.121:8080 -Method HEAD
   ```
4. 查看控制台日志中的错误信息

### 问题 2: 工具发现失败

**症状**: 连接成功但没有发现工具

**可能原因**:
- DataHub MCP 使用 HTTP/SSE 传输而非 stdio
- initialize 流程未完成

**解决方案**:
运行测试脚本诊断：
```bash
cd c:\Users\mengshiquan\Desktop\test1\pyide
python test_mcp_simple.py
```

### 问题 3: 工具执行超时

**症状**: 工具调用时超时

**解决方案**:
1. 检查 DataHub GMS 服务是否正常运行
2. 检查 Token 是否有效
3. 增加超时时间（修改 `jsonRpcClient.ts` 中的 timeout 参数）

### 问题 4: 权限问题

**症状**: 工具执行被拒绝

**解决方案**:
1. 检查权限设置：`localStorage.getItem('mcp_permissions')`
2. 在 Assist 模式下点击"始终允许"
3. 或清除权限重新设置：
   ```javascript
   localStorage.removeItem('mcp_permissions')
   ```

## 📊 工作流程详解

### 完整的工具调用流程

```
1. 用户发送消息
   ↓
2. useChat hook 构建系统提示（包含 MCP 工具列表）
   ↓
3. AI 返回响应（可能包含 [TOOL_CALL: ...] 语法）
   ↓
4. mcpChatIntegration.processToolCycle() 解析工具调用
   ↓
5. 检查权限（checkPermission）
   ↓
6. 如需确认，弹出 ToolConfirmDialog
   ↓
7. 执行工具：mcpClient.callTool(server, tool, args)
   ↓
8. JSONRPCClient 通过 stdio 发送 JSON-RPC 请求
   ↓
9. DataHub MCP Server 处理请求并返回结果
   ↓
10. 结果格式化后返回给 AI
    ↓
11. AI 基于结果生成最终回答
```

### 代码层面的关键文件

| 文件 | 作用 |
|------|------|
| `services/MCPService/client.ts` | MCP 客户端，管理连接和工具调用 |
| `services/MCPService/jsonRpcClient.ts` | JSON-RPC 2.0 协议实现 |
| `services/MCPService/chatIntegration.ts` | AI Chat 集成，工具调用流程 |
| `services/MCPService/configLoader.ts` | 配置文件加载 |
| `services/MCPService/permissions.ts` | 权限管理 |
| `hooks/useChat.ts` | Chat hook，包含工具调用循环 |
| `hooks/useChatContext.ts` | 上下文更新，注入 MCP 工具到系统提示 |
| `components/chat/AIChatPanel.tsx` | UI 组件，模式切换 |
| `components/sidebar/MCPPanel.tsx` | MCP 服务器状态面板 |

## 🎯 最佳实践

### 1. 使用 Assist 模式探索
先用 Assist 模式了解 DataHub 的能力，确认操作安全后再考虑 Agent 模式。

### 2. 设置常用工具权限
对于频繁的只读操作（search, get_lineage），可以设置为"始终允许"。

### 3. 监控 Token 使用
工具调用会增加 Token 消耗，关注底部的 Token Usage 统计。

### 4. 分步执行复杂操作
对于复杂的数据操作，建议分步进行，每步确认结果。

### 5. 利用血缘分析
DataHub 的血缘分析非常强大，可以用于：
- 影响分析：修改某个表会影响哪些下游
- 溯源分析：数据的来源和转换历史
- 依赖优化：识别冗余的数据管道

## 📝 更新配置

如果需要修改 DataHub 连接配置：

1. 编辑配置文件：`notepad $env:USERPROFILE\.pyide\mcp_config.json`
2. 重启 PyIDE 或点击 MCP Panel 的重新连接
3. 检查 MCP Panel 状态变为 "connected"

## 🚀 下一步

- [ ] 测试 DataHub MCP 工具发现（解决 stdio vs HTTP 问题）
- [ ] 实现实际的对话测试
- [ ] 启用修改工具（如需要）
- [ ] 探索高级功能（文档、属性管理等）

## 📚 相关资源

- [DataHub MCP 官方文档](https://docs.datahub.com/docs/features/feature-guides/mcp)
- [MCP 协议规范](https://modelcontextprotocol.io)
- [PyIDE MCP 测试报告](test/reports/MCP_CAPABILITY_ASSESSMENT.md)
- [DataHub MCP 配置指南](DATAHUB_MCP_SETUP.md)
