---
name: fix-mcp-deadlock
overview: 修复 mcp.rs 中 send_mcp_message 与 read_mcp_message 之间的死锁：两者都持有 channels 外层锁执行 I/O，导致读写互相阻塞。改为克隆内部 Arc 后释放外层锁，仅锁定具体流执行 I/O。
---

现在我已经完整理解了所有代码细节。根因确认无误，创建修复计划。

**根因总结：**

当前锁层级（3 层）：

```
MCP_SERVERS (全局 HashMap 锁)     ← 已在上一轮正确释放 ✓
  └─ channels: Mutex<MCPStdioChannels>   ← 问题所在！读写互斥
       ├─ stdin: Arc<Mutex<ChildStdin>>
       └─ stdout: Arc<Mutex<BufReader<...>>>
```

`send_mcp_message` 和 `read_mcp_message` 都需要先锁定整个 `channels`（MCPStdioChannels），但它们各自只需要其中一个字段。当 `read` 阻塞在 `read_line()` 时持有 `channels` 锁，`send` 永远拿不到锁 → 死锁。

**修复方案：** 在获取 `channels` 锁后，立即 `.clone()` 出需要的具体通道 Arc（stdin 或 stdout），然后释放 `channels` 锁，再只锁定具体的 I/O 句柄执行操作。<plan_result>
<req>

## 产品概述

修复 PyIDE 桌面应用中 MCP (Model Context Protocol) 与 DataHub 服务器的通信超时问题。所有 JSON-RPC 请求（initialize、tools/list、tools/call）均因死锁而超时，导致搜索功能完全不可用。

## 核心功能

- 修复 Rust 后端 `mcp.rs` 中 `channels` 级别的读写死锁：`send_mcp_message` 和 `read_mcp_message` 不再互相阻塞
- 确保前端 JSON-RPC 客户端能正常与 DataHub MCP Server 进行 initialize 握手、工具发现和工具调用
</req>

<tech>

## 技术栈

- **后端**: Rust (Tauri command), tokio::sync::Mutex, std::sync::Arc
- **前端**: TypeScript, Tauri IPC (invoke)
- **通信协议**: JSON-RPC 2.0 over stdio

## 实现方式

### 根因分析

当前数据结构有 3 层嵌套锁：

```
MCP_SERVERS: Mutex<HashMap<String, MCPServerProcess>>       ← 全局锁 (L1)
  └─ MCPServerProcess.channels: Option<Arc<Mutex<...>>>      ← 服务器级锁 (L2) ← 死锁点！
       └─ MCPStdioChannels {                                  
            stdin:  Option<Arc<Mutex<ChildStdin>>>           ← I/O句柄锁 (L3a)
            stdout: Option<Arc<Mutex<BufReader<...>>>>        ← I/O句柄锁 (L3b)
          }
```

**死链时序**：

1. 前端 `startListening()` → 调用 `read_mcp_message()` → 获取 **L2 (channels)** 锁 → 阻塞在 `read_line()` (L3b)
2. 前端 `sendRequest('initialize')` → 调用 `send_mcp_message()` → 尝试获取 **L2 (channels)** 锁 → **永远阻塞**
3. 服务器收不到请求 → 不产生输出 → L3b 的 read 永远不返回 → 完全死锁

上一轮已修复 L1 全局锁的竞争问题，但 L2 的 `channels` 锁仍然导致读写互斥。

### 修复策略

**核心改动**：在 `send_mcp_message` 和 `read_mcp_message` 中，快速获取 L2 `channels` 锁、`.clone()` 出需要的具体通道 Arc 后**立即释放 L2 锁**，然后只在 L3 级别（具体 stdin/stdout）上执行 I/O 操作。

由于 `stdin` 和 `stdout` 是独立的 `Arc<Mutex<...>>`，clone 后各自独立加锁，读写操作不再互相阻塞。

### 关键实现细节

- **`read_mcp_message` 改动**：

```rust
// 快速从 channels 中 clone 出 stdout_arc，释放 channels 锁
let stdout_arc = {
let servers = MCP_SERVERS.lock().await;
// ... get channels_arc ...
let channels = channels_arc.as_ref().ok_or(...)?.lock().await;
channels.stdout.clone()  // clone Arc，极低成本
}; // L1+L2 锁全部在此释放

// 只锁定 stdout 执行读取
let stdout = stdout_arc.ok_or(...)?.lock().await;
```

- **`send_mcp_message` 改动**：同理，快速 clone 出 `stdin_arc` 后释放 channels 锁

- **无需修改数据结构**：保持现有 `MCPServerProcess` / `MCPStdioChannels` 不变，只需优化两个函数的锁使用模式

- **无需修改前端代码**：前端 `client.ts` 和 `jsonRpcClient.ts` 无需任何变更

## 目录结构

```
apps/desktop/src-tauri/src/
└── mcp.rs    # [MODIFY] 修复 send_mcp_message 和 read_mcp_message 的锁粒度
```

</tech>

<extensions>

## Agent Extensions

- **code-explorer**
- Purpose: 验证修改后的 mcp.rs 编译通过，确认无新增错误或警告
- Expected outcome: cargo check 通过，仅有无关警告
</extensions>

<todolist>
<item id="fix-channels-deadlock" deps="">修复 mcp.rs 中 send/read 的 channels 级死锁：在 channels 锁内快速 clone 具体通道 Arc 后释放，再单独锁定 I/O 句柄</item>
<item id="verify-compilation" deps="fix-channels-deadlock">验证 cargo check 编译通过</item>
</todolist>
</plan_result>