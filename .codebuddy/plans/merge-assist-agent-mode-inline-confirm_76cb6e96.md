---
name: merge-assist-agent-mode-inline-confirm
overview: 移除 Agent 模式，将 Assist 模式重命名为 Agent 模式；将工具确认弹窗从全屏 modal 改为对话框内嵌卡片，并增加 "Allow Once" / "Always Allow" 两种选择以减少弹框频率。
design:
  architecture:
    framework: react
  styleKeywords:
    - Inline Card
    - IDE Panel
    - Compact
    - Dark Theme
  fontSystem:
    fontFamily: var(--font-mono, 'SF Mono', 'Cascadia Code', monospace)
    heading:
      size: 12px
      weight: 600
    subheading:
      size: 11px
      weight: 500
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - "#89b4fa"
      - "#b4d0f9"
    background:
      - "#1e1e2e"
      - "#181825"
      - "#11111b"
    text:
      - "#cdd6f4"
      - "#a6adc8"
    functional:
      - "#89b4fa"
      - "#a6e3a1"
      - "#f38ba8"
todos:
  - id: merge-chat-modes
    content: 合并 ChatMode 类型并更新所有模式判断逻辑（chatStore.ts、useChat.ts、chatIntegration.ts）
    status: completed
  - id: refactor-confirm-dialog
    content: 重构 ToolConfirmDialog 为内嵌卡片，支持 Allow Once 和 Always Allow 按钮
    status: completed
    dependencies:
      - merge-chat-modes
  - id: integrate-inline-dialog
    content: 在 AIChatPanel 中将确认卡片移入消息列表，接入 Always Allow 权限持久化逻辑，更新模式选择器
    status: completed
    dependencies:
      - refactor-confirm-dialog
---

## 用户需求

将现有 Chat/Assist/Agent 三模式简化为两模式：Chat 和 Agent。

### 核心功能变更

1. **移除 Assist 模式**，将其行为（需用户确认才能执行工具）赋予新的 Agent 模式
2. **移除旧 Agent 模式**（全自动执行，无确认）
3. **最终模式**：

- **Chat**：纯对话，AI 仅建议，不执行任何 MCP 工具
- **Agent**：可执行 MCP 工具，但每次都需用户在对话框内确认

4. **确认卡片内嵌到对话流中**（不再是全屏 modal overlay），显示工具名称、服务器、参数，提供两个按钮：

- "Allow Once"：仅本次允许执行
- "Always Allow"：永久允许该工具（调用 `setMCPPermission` 设为 `always_allow`），后续不再弹框

## 技术方案

### 改动范围

共涉及 6 个文件，全部为前端 TypeScript/CSS 文件，无 Rust 后端改动。

### 实现策略

**1. 模式合并（ChatMode 类型 + 条件判断）**

`ChatMode` 从 `'chat' | 'assist' | 'agent'` 改为 `'chat' | 'agent'`。所有 `chatMode === 'assist'` 判断改为 `chatMode === 'agent'`，所有 `chatMode === 'assist' || chatMode === 'agent'` 简化为 `chatMode === 'agent'`。

关键文件及行：

- `chatStore.ts:14` — 类型定义
- `useChat.ts:96,155` — MCP tools 上下文注入 + tool-calling loop 条件
- `chatIntegration.ts:86,106` — 工具执行权限判断

**2. 弹窗内嵌化（ToolConfirmDialog 重构）**

当前 `ToolConfirmDialog` 使用 `<dialog>` + `showModal()` 实现全屏模态框，有 `::backdrop` 遮罩。改为普通 `<div>` 卡片，内嵌到 `AIChatPanel` 的 `.messages` 滚动区域中。

具体改动：

- 移除 `<dialog>` 元素，改为 `<div>` 容器
- 移除 `showModal()` / `close()` 调用
- 移除 `.dialog::backdrop` 样式
- 新增内联卡片样式，视觉上与现有 `.toolStatusCard` 风格保持一致

**3. Always Allow 机制**

"Always Allow" 按钮的逻辑完全在 UI 层完成，无需改动 `onConfirm` 回调签名：

- 用户点击 "Always Allow" → 调用 `setMCPPermission(server, tool, 'always_allow')` → 写入 localStorage → resolve(true)
- 用户点击 "Allow Once" → 仅 resolve(true)，权限仍为 `'ask'`
- 下次同一工具被调用时，`checkPermission()` 返回 `'always_allow'`，`chatIntegration.ts` 直接执行，不再弹框

这意味着 `onConfirm` 回调签名 `Promise<boolean>` 无需改变。

**4. 渲染位置变更**

在 `AIChatPanel.tsx` 中，将 `<ToolConfirmDialog>` 从 panel 末尾（line 243-248）移到 `.messages` div 内部（`messagesEndRef` 之前），使其成为对话流的一部分，自动滚动可见。

### 实现注意事项

- `chatIntegration.ts` 中旧的 agent 模式逻辑（跳过 `ask` 确认直接执行）需要移除，因为新 Agent 模式 = 需确认
- `AIChatPanel.tsx` 的 `handleAlwaysAllow` 需要引入 `setMCPPermission` from `permissions.ts`
- 弹框拒绝（Deny）逻辑保持不变

### 目录结构

```
apps/desktop/src/
├── stores/
│   └── chatStore.ts              # [MODIFY] ChatMode 类型：'chat' | 'assist' | 'agent' → 'chat' | 'agent'
├── hooks/
│   └── useChat.ts                # [MODIFY] 模式条件判断简化
├── services/MCPService/
│   └── chatIntegration.ts        # [MODIFY] 移除旧 agent 自动执行逻辑，assist → agent
├── components/chat/
│   ├── AIChatPanel.tsx           # [MODIFY] 模式选择器、弹窗渲染位置、新增 Always Allow 处理
│   ├── AIChatPanel.module.css    # [MODIFY] 新增内嵌确认卡片样式
│   ├── ToolConfirmDialog.tsx     # [MODIFY] 从 dialog modal 改为 inline card，新增 Always Allow 按钮
│   └── ToolConfirmDialog.module.css  # [MODIFY] 从 modal 样式改为 inline card 样式
```

## 设计方案

将 ToolConfirmDialog 从全屏模态弹框改为内嵌在对话流中的确认卡片，视觉上与现有 `.toolStatusCard` 风格一致。

### 确认卡片设计

确认卡片渲染在消息列表底部（输入框上方），作为对话流的一部分，自动滚动到可见区域。

卡片内容自上而下：

1. **标题行**：工具图标 + "Allow tool execution?" 文字
2. **工具信息区**：Server / Tool / Arguments 三行详情，使用与现有弹框相同的 mono 字体展示
3. **操作按钮行**：两个按钮靠右排列

- "Allow Once"：次要按钮样式（outline）
- "Always Allow"：主要按钮样式（accent 色填充），视觉权重更高，引导用户选择减少弹框

### 模式选择器变更

从三个按钮 (Chat / Assist / Agent) 变为两个按钮 (Chat / Agent)，布局不变。