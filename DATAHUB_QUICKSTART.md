# 🚀 DataHub MCP 快速启动指南

## ✅ 配置状态：已完成

你的 DataHub MCP 已经配置完成，所有必要的组件都已就绪！

## 📋 当前配置

- **DataHub GMS 地址**: http://192.168.38.121:8080
- **MCP 服务器命令**: uvx mcp-server-datahub@latest
- **配置文件位置**: `C:\Users\mengshiquan\.pyide\mcp_config.json`
- **认证 Token**: 已配置 ✓

## 🎯 如何在 AI Chat 中使用 DataHub

### 方法 1：通过 PyIDE 桌面端（推荐）

1. **启动 PyIDE 桌面应用**
   ```bash
   cd c:\Users\mengshiquan\Desktop\test1\pyide\apps\desktop
   npm run tauri dev
   ```

2. **检查 MCP 连接状态**
   - 打开侧边栏的 "MCP Servers" 面板
   - 确认 datahub 服务器状态显示为 "connected"
   - 查看已发现的工具列表

3. **切换到 AI Chat 面板**
   - 点击右侧面板的 AI Chat 标签

4. **选择聊天模式**
   - **Chat 模式**：仅对话，不执行工具（安全探索）
   - **Assist 模式**：只读工具自动执行，写操作需确认（推荐）
   - **Agent 模式**：全自动执行所有工具

5. **开始对话**
   示例问题：
   - "搜索包含 'revenue' 的数据表"
   - "显示用户表的下游依赖关系"
   - "列出所有的数据资产"
   - "查看 sales_table 的 schema 信息"

### 方法 2：在 Qoder 中使用

你已经在 Qoder 的 mcp.json 中配置了 DataHub，可以直接在 Qoder 的 AI 对话中使用 DataHub 的能力。

## 🔧 可用的 DataHub 工具

### 只读工具（安全）
- **search** - 搜索数据资产
- **get_entities** - 获取实体元数据
- **get_lineage** - 查看数据血缘
- **get_lineage_paths_between** - 两个资产间的血缘路径
- **get_dataset_queries** - 获取 SQL 查询示例
- **list_schema_fields** - 列出 schema 字段
- **get_me** - 获取当前用户信息
- **search_documents** - 搜索文档
- **grep_documents** - 文档内容搜索

### 写操作工具（需确认）
需要先启用 `TOOLS_IS_MUTATION_ENABLED=true`：
- **add_tags/remove_tags** - 管理标签
- **add_terms/remove_terms** - 管理术语
- **add_owners/remove_owners** - 管理所有者
- **set_domains/remove_domains** - 管理域
- **update_description** - 更新描述
- **add_structured_properties/remove_structured_properties** - 管理属性

## 💡 使用示例

### 示例 1：数据发现
```
用户：帮我找一下所有包含 "customer" 的表

AI 会自动：
1. 调用 search 工具搜索 "customer*"
2. 返回匹配的表列表
3. 提供表的详细描述
```

### 示例 2：血缘分析
```
用户：order_items 表的数据来源是什么？

AI 会自动：
1. 先搜索获取 order_items 的 URN
2. 调用 get_lineage 获取上游血缘
3. 展示完整的数据来源链路
```

### 示例 3：SQL 参考
```
用户：有没有使用 sales 表的 SQL 示例？

AI 会自动：
1. 调用 get_dataset_queries 获取真实查询
2. 展示常用的 SQL 模式
3. 解释查询逻辑
```

## ⚙️ 启用写操作（可选）

如果需要 AI 帮你修改 DataHub 中的元数据，需要编辑配置文件：

```json
{
  "mcpServers": {
    "datahub": {
      "command": "uvx",
      "args": ["mcp-server-datahub@latest"],
      "env": {
        "DATAHUB_GMS_URL": "http://192.168.38.121:8080",
        "DATAHUB_GMS_TOKEN": "your-token",
        "TOOLS_IS_MUTATION_ENABLED": "true",
        "TOOLS_IS_USER_ENABLED": "true"
      }
    }
  }
}
```

## 🐛 故障排查

### 问题：MCP 服务器未连接
**解决方案**：
1. 确认 uvx 已安装：`uvx --version`
2. 检查 DataHub 服务是否可访问：访问 http://192.168.38.121:8080
3. 查看 PyIDE 控制台日志

### 问题：工具调用超时
**解决方案**：
1. 检查网络连接
2. 验证 Token 是否有效
3. 确认 DataHub GMS 服务正常运行

### 问题：权限被拒绝
**解决方案**：
1. 在 Assist 模式下点击"始终允许"特定工具
2. 或清除权限设置重新开始

## 📊 验证状态

运行以下命令验证配置：
```bash
cd c:\Users\mengshiquan\Desktop\test1\pyide
python verify_datahub_mcp.py
```

所有检查项应该显示 ✅ PASS。

## 📚 更多信息

- [DataHub MCP 官方文档](https://docs.datahub.com/docs/features/feature-guides/mcp)
- [PyIDE 详细使用指南](DATAHUB_AI_CHAT_GUIDE.md)
- [MCP 协议规范](https://modelcontextprotocol.io)

---

**现在就可以开始了！** 🎉

启动 PyIDE，切换到 Assist 模式，试着问 AI："帮我搜索 DataHub 中的数据表"
