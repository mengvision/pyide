# DataHub MCP 工具未发现问题诊断与修复

## 🔍 问题诊断

### 症状
- MCP 服务器连接成功（status: connected）
- 但工具列表为空（tools: []）
- AI Chat 中无法使用 DataHub 能力
- AI 只给出一般性建议，不调用工具

### 根本原因
根据测试 `test_mcp_simple.py` 的结果：
1. ✅ initialize 握手成功
2. ❌ tools/list 请求没有响应

这说明 **DataHub MCP Server 与 PyIDE 的 stdio JSON-RPC 通信存在兼容性问题**。

## 🛠️ 解决方案

### 方案 1: 手动注册工具定义（快速修复）

修改 MCPClient，在连接成功后手动添加工具定义：

```typescript
// 在 apps/desktop/src/services/MCPService/client.ts 中
// 连接成功后手动添加已知工具
```

### 方案 2: 修复 JSON-RPC 通信（根本解决）

DataHub MCP Server 可能需要：
1. 不同的消息格式（如 Content-Length 头部）
2. 特定的 initialize 参数
3. HTTP/SSE 传输而非纯 stdio

### 方案 3: 使用 mcp-remote 代理

将 HTTP/SSE 转为 stdio：
```bash
npm install -g mcp-remote
```

配置文件改为：
```json
{
  "mcpServers": {
    "datahub": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://192.168.38.121:8080/integrations/ai/mcp/?token=YOUR_TOKEN"
      ]
    }
  }
}
```

## 🎯 推荐方案：手动注册工具

这是最快的解决方案，让你立即能在 AI Chat 中使用 DataHub。
