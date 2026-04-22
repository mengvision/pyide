---
name: MCP-AI-Chat-Integration-Optimization
overview: 修复 MCP 初始化时机（从 MCPPanel 移到 App 启动时自动连接），清理系统提示构建链路，增加工具调用状态 UI 反馈，新增 MCP 全局 Zustand Store。共 4 个任务，按 1→4→2→3 顺序执行。
design:
  architecture:
    framework: react
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 14px
      weight: 600
    subheading:
      size: 12px
      weight: 500
    body:
      size: 13px
      weight: 400
  colorSystem:
    primary:
      - "#062E9A"
      - "#4A90D9"
    background:
      - "#F9FAFB"
      - "#FFFFFF"
    text:
      - "#1F2937"
      - "#6B7280"
    functional:
      - "#10B981"
      - "#EF4444"
      - "#F59E0B"
todos:
  - id: task1-mcp-init
    content: 创建 mcpInitializer.ts 并在 App.tsx 中调用，修复 MCP 初始化时机
    status: completed
  - id: task4-mcp-store
    content: 创建 mcpStore.ts (Zustand)，改造 MCPPanel 为 store consumer
    status: completed
  - id: task2-system-prompt
    content: 简化 useChat.ts 中 system prompt 构建链路，移除 .slice(1) hack
    status: completed
    dependencies:
      - task1-mcp-init
  - id: tool-ui-feedback
    content: 扩展 chatStore 工具状态 + AIChatPanel 增加工具调用实时反馈 UI
    status: completed
    dependencies:
      - task2-system-prompt
      - task4-mcp-store
---

## Product Overview

修复 AI Chat + MCP 整合中的关键问题：MCP 服务器初始化时机错误、系统提示构建链路混乱、工具调用缺少实时 UI 反馈、MCP 状态缺乏全局管理。

## Core Features

- **MCP 自动初始化**: 将 MCP 服务器连接逻辑从 MCPPanel 组件中提取，移至 App 启动时自动执行，确保 AI Chat 在任何场景下都能使用 MCP 工具
- **MCP 全局状态管理 (Zustand Store)**: 新建 mcpStore 统一管理 connections/initialization/error 状态，替代 MCPPanel 的 local state，使 AIChatPanel 等组件也能读取 MCP 连接状态
- **System Prompt 构建清理**: 简化 useChat → ChatEngine 之间的 system prompt 传递链路，消除 .slice(1) hack 和潜在的重复注入风险
- **工具调用实时 UI 反馈**: 在 chatStore 中增加工具执行状态字段，AI Chat 面板显示正在调用哪个工具、进度、结果/错误信息

## Tech Stack

- **前端框架**: React 18 + TypeScript (Tauri 2.0 桌面应用)
- **状态管理**: Zustand (与现有 chatStore/kernelStore/settingsStore 一致)
- **样式**: CSS Modules (项目已有约定)
- **通信**: JSON-RPC over stdio → Tauri Rust backend → MCP Server 子进程

## Tech Architecture

### 当前架构问题

```
App.tsx (setPlatform only)
  └── MCPPanel (useEffect 初始化) ← 问题: 不打开面板就不初始化
        └── mcpClient.connectToServer()
              └── JSONRPCClient (stdio)
```

### 目标架构

```
App.tsx (setPlatform + initializeMCPConnections)
  └── mcpInitializer.initializeMCP() ← 启动时自动执行
        ├── loadMCPConfig() → 读取配置
        ├── mcpClient.connectToServer() × N → 连接服务器
        └── useMCPStore.getState().syncConnections() → 同步到全局 store
  
  MCPPanel (纯展示, 从 store 读状态)
  AIChatPanel (从 store 读连接状态 + 工具调用反馈)

### System Prompt 清理后的数据流
```

useChat.sendMessage():

1. basePrompt = buildSystemPrompt({ variables, connectionStatus })     // kernel state
2. mcpTools   = mcpChatIntegration.getAvailableToolsForAI()            // MCP tools (仅 assist/agent)
3. fullSystem = basePrompt + mcpTools                                  // 完整 system prompt 字符串
4. engine.sendMessage(historyMessages, ..., baseSystemPrompt=fullSystem) // 直接传入
→ ChatEngine.buildSystemPrompt(fullSystem) 追加 skills/memories/kernelState context
→ 发送给 LLM API

```

### 工具调用 UI 反馈数据流
```

useChat 工具循环:
→ chatStore.setToolExecuting({ server, tool, status: 'running' })
→ AIChatPanel 渲染 "正在调用 datahub.search..."
→ 执行完成/失败
→ chatStore.setToolExecuting({ server, tool, status: 'done'|'error', result|error })
→ AIChatPanel 更新为结果摘要或错误

```

## Implementation Details

### Module Division
- **MCP Initializer** (`services/MCPService/mcpInitializer.ts`): 独立初始化函数，从 config 加载→连接→同步 store
- **MCP Store** (`stores/mcpStore.ts`): Zustand store，connections/isInitialized/error/toolExecutionState
- **chatStore 扩展**: 增加 toolExecution 相关 state
- **useChat 简化**: 移除 .slice(1) hack，直接传 baseSystemParam
- **MCPPanel 改造**: 去除初始化逻辑，改为 store consumer
- **AIChatPanel 增强**: 工具状态指示器 UI

### 关键约束
1. `mcpClient` 是 module-level singleton，不改变其核心 API，只在其操作后同步 store
2. 保持 `initializeMCP()` 幂等 — 多次调用不会重复连接（通过 initialized flag 或检查 connections）
3. `ChatEngine.buildSystemPrompt()` 接口不变，只优化调用方传入方式
4. 工具状态是瞬时的（不需要持久化到 localStorage），只存在于当前会话

## Directory Structure Summary
本方案在现有项目结构上新增/修改以下文件：

```

apps/desktop/src/
├── services/MCPService/
│   ├── client.ts                    # [MODIFY] connectToServer/disconnectFromServer 后同步 mcpStore
│   ├── mcpInitializer.ts            # [NEW] MCP 初始化函数（从 MCPPanel 提取）
│   ├── chatIntegration.ts           # [MODIFY] 无需改动（保持不变）
│   ├── configLoader.ts              # [无变化]
│   ├── jsonRpcClient.ts             # [无变化]
│   └── permissions.ts               # [无变化]
├── stores/
│   ├── mcpStore.ts                  # [NEW] MCP 全局 Zustand store
│   └── chatStore.ts                 # [MODIFY] 增加 toolExecutionState 字段
├── hooks/
│   └── useChat.ts                   # [MODIFY] 简化 system prompt 构建 + 工具状态更新
├── components/
│   ├── sidebar/
│   │   ├── MCPPanel.tsx             # [MODIFY] 改为 store consumer，移除初始化
│   │   └── MCPPanel.css             # [无变化]
│   └── chat/
│       └── AIChatPanel.tsx          # [MODIFY] 增加工具调用状态指示器
├── App.tsx                          # [MODIFY] 调用 initializeMCPConnections
├── services/
│   ├── ChatEngine.ts                # [MODIFY] 注释澄清职责边界（代码逻辑不变）
│   └── chatContext.ts               # [无变化]
```

本次任务主要是逻辑层优化，不涉及新建页面或大规模 UI 重构。但 Task 3（工具调用状态反馈）需要在 AIChatPanel 中增加小型 UI 组件。

设计范围限定在：

1. **工具状态指示器**: 内嵌于 AIChatPanel 的消息列表区域，当工具执行时显示一个紧凑的状态卡片，包含工具名称、spinner 动画、状态文字。完成后折叠为单行结果摘要。
2. **MCPPanel 改造**: 从有状态的初始化器变为纯展示组件，视觉上保持不变，只是数据来源从 local state 改为 mcpStore。

整体风格与现有 IDE 界面保持一致：使用 CSS 变量（var(--bg-secondary), var(--border-color) 等）、紧凑布局、等宽字体用于技术标识。

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 在实现过程中验证文件引用关系和 import 路径正确性，确认没有遗漏的依赖
- Expected outcome: 确保每个修改文件的 import/export 都能正确解析，避免循环引用