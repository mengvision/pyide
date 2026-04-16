# PyIDE Console 改造与 Remote 模式修复技术报告

> 日期：2026-04-16  
> 作者：开发团队  
> 版本：v1.0

---

## 目录

1. [OUTPUT 面板改造为 REPL 风格 Console](#1-output-面板改造为-repl-风格-console)
2. [stderr 分级颜色显示（Info / Warning / Error）](#2-stderr-分级颜色显示info--warning--error)
3. [Python 异常（NameError 等）不显示在 Console](#3-python-异常nameerror-等不显示在-console)
4. [Remote 模式连接状态显示 connecting/disconnected](#4-remote-模式连接状态显示-connectingdisconnected)
5. [Remote 模式 Python 版本显示 "--"](#5-remote-模式-python-版本显示---)
6. [Local 切换 Remote 闪登录界面](#6-local-切换-remote-闪登录界面)
7. [总结](#7-总结)

---

## 1. OUTPUT 面板改造为 REPL 风格 Console

### 问题描述

原 OUTPUT 面板仅用于展示单次代码执行的输出结果，缺乏交互性和历史记录能力，无法作为真正意义上的终端/REPL 环境使用。用户需要一个类似 Jupyter Console 或 IPython 的交互式界面，支持历史记录查看、逐条执行展示以及持久化保存。

### 根因分析

原设计将输出结果绑定在单个 cell 上，没有维护全局的执行历史列表；输入框组件缺失，无法在 Console 面板内直接输入并执行代码；执行历史无持久化机制，重启后丢失所有记录。

### 修复方案

#### 数据模型

在 `packages/protocol/kernel.ts` 中新增 `ReplEntry` 接口，包含以下字段：

```typescript
interface ReplEntry {
  id: string;
  code: string;
  outputs: OutputData[];
  executionCount: number;
  timestamp: number;
}
```

#### 状态管理

在 `kernelStore.ts` 中新增以下状态和 Actions：

- **状态**：`replHistory: ReplEntry[]`、`inputHistory: string[]`
- **Actions**：`addReplEntry`、`appendReplOutput`、`clearReplHistory`、`addInputHistory`、`setReplHistory`

#### 执行流改造

修改 `useKernel.ts` 和 `useRemoteKernel.ts` 的 `executeCode` 方法：

1. 执行前创建 `ReplEntry` 并调用 `addReplEntry` 写入状态
2. stream callback 中调用 `appendReplOutput` 追加流式输出到对应条目

#### UI 重写

重写 `OutputPanel.tsx`，从展示单个 cell outputs 改为遍历渲染 `replHistory` 数组：

- 每条记录展示 `In [n]:` 提示符 + 代码高亮块
- 代码下方渲染对应的输出结果列表
- 自动滚动到最新条目

#### 底部输入框

新建 `ReplInput.tsx` 组件，支持以下交互：

- **Enter**：提交代码执行
- **Shift+Enter**：换行（多行输入）
- **↑ / ↓ 箭头**：翻历史输入记录

#### 历史自动保存

新建 `replHistoryService.ts`，利用 PlatformService 文件 API 将历史保存到工作区：

- `.pyide_history`：纯文本格式（每条代码以 `# ---` 分隔）
- `.pyide_history.json`：JSON 格式（完整 ReplEntry 数组）
- 防抖 2 秒自动触发保存，避免频繁写盘

`KernelContext.tsx` 在挂载时读取历史文件恢复状态，并通过 `subscribe` 监听 `replHistory` 变化自动调用保存服务。

### 涉及文件

| 文件路径 | 变更类型 |
|----------|----------|
| `packages/protocol/kernel.ts` | 修改 |
| `apps/desktop/src/stores/kernelStore.ts` | 修改 |
| `apps/desktop/src/hooks/useKernel.ts` | 修改 |
| `apps/desktop/src/hooks/useRemoteKernel.ts` | 修改 |
| `apps/desktop/src/components/output/OutputPanel.tsx` | 修改 |
| `apps/desktop/src/components/output/OutputPanel.module.css` | 修改 |
| `apps/desktop/src/components/output/ReplInput.tsx` | **新建** |
| `apps/desktop/src/components/output/ReplInput.module.css` | **新建** |
| `apps/desktop/src/services/replHistoryService.ts` | **新建** |
| `apps/desktop/src/contexts/KernelContext.tsx` | 修改 |

---

## 2. stderr 分级颜色显示（Info / Warning / Error）

### 问题描述

所有来自 stderr 的输出统一被当作 error 处理，以红色显示。这导致 `logging.info()`、pip 安装进度、`DeprecationWarning` 等非错误信息也以错误样式展示，干扰用户判断真实错误。

### 根因分析

`outputRouter.ts` 在处理 stderr 时没有对内容进行分类，直接将 type 设置为 `'error'`。前端渲染层也只有 error 一种 stderr 样式，缺少 warning 和 info 级别的视觉区分。

### 修复方案

#### 类型扩展

在 `packages/protocol/kernel.ts` 中扩展 `OutputData.type` 的联合类型，新增 `'warning'` 和 `'info'` 两个枚举值。

#### 分级路由

改造 `outputRouter.ts` 的 stderr 处理逻辑，新增 `classifyStderrLevel()` 函数，通过正则表达式匹配内容自动判断级别：

```typescript
function classifyStderrLevel(text: string): 'error' | 'warning' | 'info' {
  if (/Traceback|Exception|Error:/i.test(text)) return 'error';
  if (/Warning|DeprecationWarning/i.test(text)) return 'warning';
  return 'info';
}
```

#### 新增 LogOutput 组件

新建 `LogOutput.tsx` 和 `LogOutput.module.css`，带有 badge 图标和级别颜色标记。颜色规范如下：

| 级别 | 左边框颜色 | 图标 | 适用场景 |
|------|-----------|------|---------|
| error | 红色 `var(--status-error)` | ❌ | Traceback、Exception |
| warning | 黄色 `var(--status-warning)` | ⚠️ | DeprecationWarning 等 |
| info | 蓝色 `#3b82f6` | ℹ️ | 其他 stderr（logging.info、pip 信息等） |

#### OutputPanel 扩展

在 `OutputPanel.tsx` 的 `OutputRenderer` switch-case 中新增 `'warning'` 和 `'info'` 两个 case，均渲染 `LogOutput` 组件并传入对应级别。

### 涉及文件

| 文件路径 | 变更类型 |
|----------|----------|
| `packages/protocol/kernel.ts` | 修改 |
| `apps/desktop/src/utils/outputRouter.ts` | 修改 |
| `apps/desktop/src/components/output/LogOutput.tsx` | **新建** |
| `apps/desktop/src/components/output/LogOutput.module.css` | **新建** |
| `apps/desktop/src/components/output/OutputPanel.tsx` | 修改 |

---

## 3. Python 异常（NameError 等）不显示在 Console

### 问题描述

执行引用不存在变量或函数的代码（例如 `undefined_var`）时，Python 解释器会抛出 `NameError`，但 Console 面板没有任何错误提示，用户无法感知代码执行失败。

### 根因分析

pykernel 在捕获 Python 异常后，将错误信息封装在 RPC 响应的 `result.error` 字段中返回，而非通过 stream 回调（output_callback）发送。前端 `executeCode` 函数仅处理 stream 回调的输出，没有检查 execute 的返回结果中是否包含错误信息，导致异常被静默丢弃。

### 修复方案

在 `useKernel.ts` 和 `useRemoteKernel.ts` 的 `executeCode` 中，在 `await client.execute()` 调用返回后新增错误检查逻辑：

```typescript
const result = await client.execute(code, outputCallback);
if (result.status === 'error') {
  const errorOutput: OutputData = {
    type: 'error',
    text: result.error ?? '执行出错',
  };
  addOutput(cellId, errorOutput);
  appendReplOutput(replEntryId, errorOutput);
}
```

此修复同时写入 cell 输出（用于 Notebook 视图）和 REPL 历史（用于 Console 视图），确保两个视图的一致性。

### 涉及文件

| 文件路径 | 变更类型 |
|----------|----------|
| `apps/desktop/src/hooks/useKernel.ts` | 修改 |
| `apps/desktop/src/hooks/useRemoteKernel.ts` | 修改 |

---

## 4. Remote 模式连接状态显示 connecting/disconnected

### 问题描述

切换到 remote kernel 模式后，即使远程 kernel 实际工作正常、代码执行无误，前端状态栏的连接状态仍在 `connecting` 和 `disconnected` 之间不断交替闪烁，用户体验极差。

### 根因分析

该问题由多个层次的缺陷叠加造成：

#### (a) 双模式状态冲突

`useKernel()` 受 React Hooks 规则约束，必须无条件地同时调用 `useLocalKernel()` 和 `useRemoteKernel()`。两者各自的 `statusCallback` 都会写入同一个全局 `kernelStore.connectionStatus`。

在 remote 模式下，local KernelClient 仍在尝试连接 `ws://127.0.0.1:8766/`，连接失败触发状态更新为 `disconnected`，从而覆盖 remote 侧刚刚设置的 `connected` 状态，形成交替闪烁。

#### (b) Zombie 客户端

`startKernel()` 中存在如下竞态问题：

```typescript
// 原来的问题代码
const client = new KernelClient(...);
await client.connect();          // ← 若此时发生模式切换
clientRef.current = client;      // ← cleanup 无法找到 client
```

如果模式切换发生在 `connect()` 期间，cleanup 函数读取 `clientRef.current` 时还是旧值（null 或旧 client），新建的 client 成为 zombie，在后台无限重连。

### 修复方案

#### 修复一：statusCallback 加模式守卫

```typescript
statusCallback: (status) => {
  if (kernelMode !== 'local') return; // 只有 active 模式才写入
  setConnectionStatus(status);
}
```

#### 修复二：模式切换时断开非 active 客户端

在 `useEffect` 中监听 `kernelMode` 变化，切换时主动调用非 active 模式的 client disconnect。

#### 修复三：clientRef 提前赋值

```typescript
clientRef.current = client; // ← 移到 connect() 之前
await client.connect();
```

确保 cleanup 函数始终能找到并 disconnect 正在连接中的 client。

#### 修复四：startKernel 全流程模式检查

在 `startKernel` 开头及每个 async 操作（connect、kernelInfo 等）之后添加模式一致性检查，模式不匹配时立即调用 `client.disconnect()` 并退出。

#### 修复五：connect 失败主动断开

连接失败时主动调用 `client.disconnect()`，阻止 `scheduleReconnect` 形成无限重连循环。

#### 修复六：RemoteKernelClient 连接超时

为 `RemoteKernelClient.connect()` 添加 10 秒超时机制，防止长时间挂起。

#### 修复七：添加调试日志

在 `_setStatus`、WebSocket `onclose`、`onerror` 回调中添加调试日志，方便后续排查连接问题。

### 涉及文件

| 文件路径 | 变更类型 |
|----------|----------|
| `apps/desktop/src/hooks/useKernel.ts` | 修改 |
| `apps/desktop/src/hooks/useRemoteKernel.ts` | 修改 |
| `apps/desktop/src/services/KernelClient.ts` | 对比参考 |

---

## 5. Remote 模式 Python 版本显示 "--"

### 问题描述

切换到 remote kernel 模式并连接成功后，状态栏中 Python 版本始终显示为 `--`，而非实际的 Python 版本号（如 `3.11.5`）。

### 根因分析

`useRemoteKernel.ts` 在连接成功后的初始化流程中，没有调用 `kernelInfo()` 方法获取远程 kernel 的 Python 环境信息，而 `envStore` 的 Python 版本字段也未被更新，导致状态栏一直显示默认的 `--`。

相比之下，`useKernel.ts`（local 模式）在启动后会调用 `kernelInfo()` 并将结果写入 `envStore`，两者行为不一致。

### 修复方案

#### RemoteKernelClient 新增便捷方法

```typescript
async kernelInfo(): Promise<KernelInfoResult> {
  return this.rpc.call('kernel_info', {});
}
```

#### startKernel 连接成功后获取版本信息

```typescript
const info = await client.kernelInfo();
setEnv({
  name: 'Remote Python',
  pythonVersion: info.python_version,
  // ...
});
```

### 涉及文件

| 文件路径 | 变更类型 |
|----------|----------|
| `apps/desktop/src/hooks/useRemoteKernel.ts` | 修改 |

---

## 6. Local 切换 Remote 闪登录界面

### 问题描述

从 local kernel 模式切换到 remote 模式时，即使浏览器本地已保存有效的 access token，也会短暂（约 100–300ms）闪出 Login 登录页面，随后再切回主界面，体验突兀。

### 根因分析

`App.tsx` 中认证状态的初始值为 `false`：

```typescript
const [isAuthenticated, setIsAuthenticated] = useState(false); // 初始为 false
```

切换到 remote 模式时，React 同步渲染时判断 `kernelMode === 'remote' && !isAuthenticated` 立即为 `true`，页面立刻渲染 Login 组件。此后异步 token 验证逻辑完成，将 `isAuthenticated` 设置为 `true`，页面再切回主界面——这一先渲染 Login 再切回的过程造成了视觉上的闪烁。

### 修复方案

新增 `checkingAuth` 状态，在切换到 remote 模式时先执行异步 token 验证：

```typescript
const [checkingAuth, setCheckingAuth] = useState(false);

// 切换到 remote 模式时
setCheckingAuth(true);
const valid = await verifyToken(storedToken);
setIsAuthenticated(valid);
setCheckingAuth(false);
```

在渲染逻辑中，当 `checkingAuth === true` 时返回 `null`（不渲染任何内容），等验证完成后再决定显示主界面或 Login 页面：

```typescript
if (kernelMode === 'remote') {
  if (checkingAuth) return null;          // 验证中：什么都不渲染
  if (!isAuthenticated) return <Login />; // 验证失败：显示登录
}
// 验证成功或 local 模式：显示主界面
```

### 涉及文件

| 文件路径 | 变更类型 |
|----------|----------|
| `apps/desktop/src/App.tsx` | 修改 |

---

## 7. 总结

本轮共解决 **6 个技术问题**，涵盖功能开发、UI 改造、状态管理、竞态条件修复和认证流程优化等多个方向。

### 文件统计

| 统计项 | 数量 |
|--------|------|
| **修改文件数** | 13 |
| **新建文件数** | 6 |
| **合计** | 19 |

### 新建文件列表

| 文件路径 | 用途 |
|----------|------|
| `apps/desktop/src/components/output/ReplInput.tsx` | REPL 底部输入框组件 |
| `apps/desktop/src/components/output/ReplInput.module.css` | ReplInput 样式 |
| `apps/desktop/src/services/replHistoryService.ts` | REPL 历史持久化服务 |
| `apps/desktop/src/components/output/LogOutput.tsx` | stderr 分级日志显示组件 |
| `apps/desktop/src/components/output/LogOutput.module.css` | LogOutput 样式 |

### 修改文件列表

| 文件路径 | 涉及问题 |
|----------|----------|
| `packages/protocol/kernel.ts` | 问题 1、2 |
| `apps/desktop/src/stores/kernelStore.ts` | 问题 1 |
| `apps/desktop/src/hooks/useKernel.ts` | 问题 1、3、4 |
| `apps/desktop/src/hooks/useRemoteKernel.ts` | 问题 1、3、4、5 |
| `apps/desktop/src/components/output/OutputPanel.tsx` | 问题 1、2 |
| `apps/desktop/src/components/output/OutputPanel.module.css` | 问题 1 |
| `apps/desktop/src/contexts/KernelContext.tsx` | 问题 1 |
| `apps/desktop/src/utils/outputRouter.ts` | 问题 2 |
| `apps/desktop/src/App.tsx` | 问题 6 |

### 关键经验

1. **React Hooks 规则的约束**：Hook 不能条件调用，多 Hook 共享全局状态时需要通过模式守卫过滤，避免非 active 模式的状态更新干扰全局。

2. **async 操作的竞态问题**：`clientRef` 等可变引用的赋值时机至关重要，必须在 async 操作之前完成，确保 cleanup 逻辑在任意时刻都能正确访问。

3. **异步状态初始化的 UI 闪烁**：认证状态等初始为 `false` 的异步状态，应引入 `loading/checking` 中间态，在验证完成前不做任何渲染决策，避免页面闪烁。

4. **pykernel RPC 错误约定**：pykernel 通过 `result.error` 而非 stream 回调返回 Python 异常，前端需要在 execute 返回后主动检查，不能只依赖 stream 输出。
