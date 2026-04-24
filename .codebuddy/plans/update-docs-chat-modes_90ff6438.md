---
name: update-docs-chat-modes
overview: 修改 docs/03-ai-chat-skill-mcp.md，将三种交互模式更新为两种（Chat + Agent），删除 Assist 模式，对齐当前代码实现
todos:
  - id: update-doc-modes
    content: 修改 docs/03-ai-chat-skill-mcp.md 中交互模式为两种：Chat + Agent
    status: completed
---

## 产品概述

更新 PyIDE 设计文档 `docs/03-ai-chat-skill-mcp.md` 中的交互模式描述，将原来的三种模式（Chat / Assist / Agent）修改为当前实际实现的两种模式（Chat / Agent），与代码实现对齐。

## 核心功能

- 删除 Assist (semi-auto) 模式的全部描述
- 将 "Three Interaction Modes" 改为 "Two Interaction Modes"
- 修改 AI Tools 表格的 Mode Restriction 列，移除 Assist 相关限制说明
- 修改 Tool Call Flow 图，删除 Assist 分支，只保留 Chat 和 Agent 两条路径

## 技术栈

- 纯 Markdown 文档修改，无需编译或运行时验证

## 实现方案

直接修改 `docs/03-ai-chat-skill-mcp.md` 文件的 4 处位置：

1. **第7行标题**: `Three Interaction Modes` → `Two Interaction Modes`
2. **第9-38行模式框图**: 删除 Mode 2: Assist (semi-auto) 整个区块，Mode 3 Agent 改为 Mode 2
3. **第129-137行 AI Tools 表格**: Mode Restriction 列更新为 `Chat (preview only) / Agent (auto)`，去掉所有 `Assist (confirm)` 引用
4. **第139-151行 Tool Call Flow 图**: 删除 `Mode: Assist → Show preview, user clicks [Confirm]` 分支，只保留 Chat 和 Agent 两条路径

## 目录结构

```
docs/
└── 03-ai-chat-skill-mcp.md  # [MODIFY] 更新交互模式为两种
```