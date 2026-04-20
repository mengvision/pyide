# DataHub MCP Server 配置指南

## 配置状态

✅ **配置文件已创建**: `C:\Users\mengshiquan\.pyide\mcp_config.json`

## 配置详情

```json
{
  "mcpServers": {
    "datahub": {
      "command": "uvx",
      "args": ["mcp-server-datahub@latest"],
      "env": {
        "DATAHUB_GMS_URL": "http://192.168.38.121:8080",
        "DATAHUB_GMS_TOKEN": "eyJhbGciOiJIUzI1NiJ9..."
      }
    }
  }
}
```

## 测试结果

### ✅ 成功的部分
- MCP 服务器进程可以成功启动
- initialize 握手成功，服务器返回：
  - 名称: datahub
  - 版本: 2.14.7
  - 协议版本: 2024-11-05
  - 支持的能力: prompts, resources, tools, tasks

### ⚠️ 需要修复的问题
- tools/list 请求未收到响应
- 可能原因：DataHub MCP 使用了 HTTP SSE 传输而非纯 stdio JSON-RPC

## 问题分析

根据 DataHub 官方文档，DataHub MCP 支持以下传输方式：
1. **Streamable HTTP** (推荐，用于远程连接)
2. **SSE** (旧版远程连接)
3. **stdio** (本地连接，需要本地安装)

当前 PyIDE 的 MCP 实现仅支持 **stdio** 传输方式，但你的 DataHub 服务器部署在远程 (192.168.38.121:8080)。

## 解决方案

### 方案 1: 扩展 PyIDE 支持 HTTP/SSE 传输 (推荐)

需要修改 PyIDE 的 MCP 客户端以支持远程 HTTP 连接。这需要：
1. 添加 HTTP SSE 客户端支持
2. 修改 PlatformService 接口支持远程 URL
3. 更新 MCPClient 以支持多种传输方式

### 方案 2: 使用 mcp-remote 代理 (临时方案)

使用 `mcp-remote` 工具将远程 HTTP 服务转换为本地 stdio 服务：

```bash
# 安装 mcp-remote
npm install -g mcp-remote

# 更新配置文件使用 mcp-remote 代理
```

配置文件将改为：
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

### 方案 3: 本地部署 DataHub MCP Server

在本地运行 DataHub MCP Server，通过环境变量连接远程 GMS：

```bash
# 当前配置已经是这种方式
uvx mcp-server-datahub@latest
```

但需要确认该版本是否完全支持 stdio 模式。

## 下一步行动

1. **确认 DataHub MCP 版本支持的传输方式**
2. **选择上述方案之一进行实施**
3. **测试工具发现和调用功能**

## 相关资源

- DataHub MCP 文档: https://docs.datahub.com/docs/features/feature-guides/mcp
- MCP 协议规范: https://modelcontextprotocol.io
- PyIDE MCP 实现: `apps/desktop/src/services/MCPService/`

## 测试脚本

已创建测试脚本：
- `test_datahub_mcp.py` - 完整测试脚本
- `test_mcp_simple.py` - 简化测试脚本

运行测试：
```bash
cd pyide
python test_mcp_simple.py
```
