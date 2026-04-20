# ✅ DataHub MCP + AI Chat 集成修复完成

## 🎯 问题诊断

### 原始问题
- ✅ MCP 服务器连接成功
- ❌ 工具列表为空（tools: []）
- ❌ AI Chat 中无法使用 DataHub 能力
- ❌ AI 只给出一般性建议，不调用工具

### 根本原因
DataHub MCP Server 的 `tools/list` JSON-RPC 请求没有响应，导致工具发现失败。这可能是由于：
1. DataHub MCP 使用不同的消息格式
2. stdio 传输兼容性问题
3. 需要特定的初始化流程

## 🔧 修复方案

### 修改 1: 手动注册工具（client.ts）

**文件**: `apps/desktop/src/services/MCPService/client.ts`

**改动**:
```typescript
// 在 connectToServer 方法中添加 fallback 逻辑
let tools = await this.discoverTools(serverName);

// Fallback: If tool discovery fails, manually register known tools for DataHub
if (tools.length === 0 && serverName === 'datahub') {
  console.log('Tool discovery returned empty, using manual tool registration for DataHub');
  tools = this.getKnownDataHubTools();
}
```

**新增方法**: `getKnownDataHubTools()`
- 手动定义了 7 个 DataHub 工具
- 包含完整的工具描述和参数 schema
- 工具列表：
  1. `search` - 搜索数据资产
  2. `get_lineage` - 获取数据血缘
  3. `get_dataset_queries` - 获取 SQL 查询示例
  4. `get_entities` - 批量获取实体元数据
  5. `list_schema_fields` - 列出 schema 字段
  6. `get_lineage_paths_between` - 获取两个资产间的血缘路径
  7. `get_me` - 获取当前用户信息

### 修改 2: 增强工具描述格式（chatIntegration.ts）

**文件**: `apps/desktop/src/services/MCPService/chatIntegration.ts`

**改动**:
- 添加详细的使用说明
- 为每个工具添加参数说明（标注必需/可选）
- 添加具体的使用示例
- 添加强调提示，确保 AI 理解工具调用格式

**系统提示示例**:
```
=== AVAILABLE MCP TOOLS ===

You have access to the following MCP servers and tools. Use them when the user asks about data, metadata, lineage, or related operations.

## Server: datahub
You can use tools from the "datahub" server by responding with:
[TOOL_CALL: datahub.tool_name({"arg1": "value1", "arg2": "value2"})]

### Available Tools:

#### search
**Description:** Search DataHub using structured keyword search (/q syntax) with boolean logic, filters, pagination, and optional sorting by usage metrics.
**Parameters:**
- query (string, required): Search query using /q syntax, e.g., "revenue_*" or "tag:PII"
- start (number): Starting offset for pagination
- count (number): Number of results to return

### Usage Examples:
- To search for data: [TOOL_CALL: datahub.search({"query": "revenue_*"})]
- To get lineage: [TOOL_CALL: datahub.get_lineage({"urn": "urn:li:dataset:...", "direction": "DOWNSTREAM"})]

**IMPORTANT:** Always use the exact format [TOOL_CALL: server.tool({json})] with proper JSON syntax.
```

## ✅ 测试结果

运行 `python test_mcp_chat_integration.py`：

```
✅ Tool Registration: PASS
✅ Chat Integration: PASS  
✅ System Prompt: PASS
✅ Tool Call Parsing: PASS
✅ User Scenario: PASS

🎉 All tests passed!
```

## 🚀 如何使用

### 1. 重启 PyIDE

```bash
# 如果 PyIDE 正在运行，先关闭它
# 然后重新启动
cd c:\Users\mengshiquan\Desktop\test1\pyide\apps\desktop
npm run tauri dev
```

### 2. 验证工具注册

打开侧边栏的 **MCP Servers** 面板，你应该看到：
- datahub 服务器状态：connected
- **Available Tools (7)** - 显示 7 个工具

### 3. 测试 AI Chat

1. 切换到 AI Chat 面板
2. 选择 **Assist 模式**（或 Agent 模式）
3. 提问：**"datahub 里边有没有关于外呼次数的字段"**

### 4. 预期行为

AI 现在应该：
1. 识别到需要搜索 DataHub
2. 输出工具调用：`[TOOL_CALL: datahub.search({"query": "外呼次数"})]`
3. 系统执行工具调用
4. AI 基于搜索结果生成回答
5. 告诉你找到了哪些相关字段

## 📝 其他测试用例

你可以尝试以下问题来测试不同的工具：

| 用户问题 | 预期调用的工具 |
|---------|--------------|
| "搜索包含 revenue 的表" | `datahub.search` |
| "用户表的数据来源是什么" | `datahub.get_lineage` |
| "显示 sales_table 的 schema" | `datahub.list_schema_fields` |
| "获取这些表的详细信息" | `datahub.get_entities` |
| "有没有使用 sales 表的 SQL 示例" | `datahub.get_dataset_queries` |

## 🔍 故障排查

### 问题：工具列表仍然为空

**检查步骤**:
1. 打开浏览器开发者工具（F12）
2. 查看控制台日志
3. 应该看到：`Tool discovery returned empty, using manual tool registration for DataHub`
4. 然后看到：`MCP server datahub connected successfully with 7 tools`

### 问题：AI 仍然不调用工具

**可能原因**:
1. **模式错误**：确保使用 Assist 或 Agent 模式（不是 Chat 模式）
2. **AI 模型**：某些小型 AI 模型可能不理解工具调用格式
3. **系统提示**：检查网络请求，确认系统提示中包含 MCP 工具信息

**调试方法**:
```javascript
// 在浏览器控制台运行
const { useChatStore } = await import('./stores/chatStore');
console.log('Chat mode:', useChatStore.getState().chatMode);
// 应该显示 'assist' 或 'agent'
```

### 问题：工具调用失败

**检查**:
1. MCP Panel 中 datahub 状态是否为 connected
2. 控制台是否有 JSON-RPC 错误
3. DataHub GMS 服务是否正常运行

## 📊 技术细节

### 工作流程

```
用户提问
  ↓
AI Chat (Assist/Agent mode)
  ↓
构建系统提示（包含 MCP 工具列表）
  ↓
AI 识别需要调用工具
  ↓
AI 输出: [TOOL_CALL: datahub.search({"query": "外呼次数"})]
  ↓
mcpChatIntegration.processToolCycle()
  ↓
解析工具调用
  ↓
检查权限（Assist 模式可能需要确认）
  ↓
mcpClient.callTool('datahub', 'search', {...})
  ↓
JSONRPCClient 发送 JSON-RPC 请求
  ↓
DataHub MCP Server 处理请求
  ↓
返回搜索结果
  ↓
AI 基于结果生成回答
  ↓
展示给用户
```

### 关键代码位置

| 文件 | 作用 |
|------|------|
| `services/MCPService/client.ts` | MCP 客户端，包含手动工具注册 |
| `services/MCPService/chatIntegration.ts` | AI Chat 集成，工具描述格式化 |
| `hooks/useChat.ts` | Chat hook，包含工具调用循环 |
| `utils/toolCallParser.ts` | 工具调用解析器 |
| `components/chat/AIChatPanel.tsx` | UI 组件，模式切换 |

## 🎓 学到的经验

1. **不是所有 MCP Server 都完全兼容**：有些服务器可能使用不同的消息格式或传输方式
2. **Fallback 机制很重要**：当自动发现失败时，手动注册可以保证功能可用
3. **系统提示质量影响 AI 行为**：清晰的工具描述和示例能显著提高 AI 调用工具的准确性
4. **测试端到端流程**：不仅测试连接，还要测试完整的用户场景

## 📚 相关文档

- [DATAHUB_AI_CHAT_GUIDE.md](DATAHUB_AI_CHAT_GUIDE.md) - 详细使用指南
- [DATAHUB_QUICKSTART.md](DATAHUB_QUICKSTART.md) - 快速启动指南
- [MCP_TOOLS_DISCOVERY_FIX.md](MCP_TOOLS_DISCOVERY_FIX.md) - 问题诊断文档

---

**现在就去试试吧！** 🎉

重启 PyIDE，切换到 Assist 模式，问 AI："datahub 里边有没有关于外呼次数的字段"
