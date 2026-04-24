# 03 · AI Chat, Skill System & MCP Integration

## 1. AI Chat System Overview

The AI Chat is not just a chatbot — it's an **AI assistant that can directly operate the Python kernel**. It can execute code, inspect variables, and manipulate the workspace on behalf of the user.

### Two Interaction Modes

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AI Chat Interaction Modes                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Mode 1: Chat (default)                                                      │
│  ────────────────────────                                                   │
│  - AI responds with suggestions, explanations, code blocks                  │
│  - Code blocks have action buttons: [Execute] [Insert Cell] [Copy]         │
│  - User clicks to execute                                                   │
│  - MCP tools are NOT injected — AI cannot call external tools               │
│  - Use case: Learning, exploration, consultation                            │
│                                                                              │
│  Mode 2: Agent (auto-execute)                                               │
│  ───────────────────────────────                                            │
│  - AI has full autonomy to execute any code                                 │
│  - MCP tools are injected — AI can call external tools                      │
│  - Tool execution with user confirmation for sensitive operations           │
│  - Still respects allowed_tools from active Skill                           │
│  - Use case: Automated analysis, batch processing, data pipelines           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. AI Chat Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           AI Chat Architecture                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Message ──▶ Context Builder ──▶ Model Router ──▶ LLM API             │
│                         │                    │                   │            │
│                         ▼                    ▼                   ▼            │
│              ┌─────────────────┐    ┌────────────────┐   ┌────────────────┐ │
│              │ Inject Context: │    │ Select Model:  │   │ Stream Response│ │
│              │ - Kernel state  │    │ - Config default│   │ - Parse tool_  │ │
│              │ - Active skill  │    │ - Skill override│   │   calls        │ │
│              │ - Memory       │    │ - User override │   │ - Render markdown│
│              │ - MCP tools    │    │                 │   │ - Dispatch tools│ │
│              └─────────────────┘    └────────────────┘   └────────────────┘ │
│                                                                │             │
│                                                                ▼             │
│                                                        ┌─────────────────┐   │
│                                                        │ Response Handler │   │
│                                                        │ - Code blocks   │   │
│                                                        │ - Tool results  │   │
│                                                        │ - Stream to UI  │   │
│                                                        └─────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Context Builder

```typescript
interface ChatContext {
  // 1. Kernel State (always injected)
  kernel_state: {
    variables: VariableInfo[];      // Name, type, shape, size
    recent_executions: string[];    // Last 10 cell codes
    installed_packages: string[];   // From pip list
    working_directory: string;
    active_env: string;             // uv venv name
  };

  // 2. Active Skill (if any)
  skill_context?: {
    name: string;
    description: string;
    prompt: string;                 // The skill's system prompt
    allowed_tools: string[];
  };

  // 3. Relevant Memory (retrieved by query)
  memory_entries: MemoryEntry[];

  // 4. MCP Tool Declarations (tools the AI can call)
  mcp_tools: MCPToolDeclaration[];
}
```

### Model Router

```typescript
interface ModelConfig {
  provider: "openai" | "anthropic" | "openai_compatible";
  base_url: string;    // e.g., "https://api.openai.com/v1"
  api_key: string;     // Stored in OS Keyring (desktop) or env var (server)
  model_id: string;    // e.g., "gpt-4o", "claude-sonnet-4-20250514"
}

// Priority: skill_override > user_override > default_config
function selectModel(context: ChatContext): ModelConfig {
  if (context.skill_context?.model_override) {
    return context.skill_context.model_override;
  }
  if (userSettings.preferredModel) {
    return userSettings.preferredModel;
  }
  return systemConfig.defaultModel;
}
```

---

## 3. AI Tools (Kernel Operations)

These are tools the AI can call to interact with the kernel:

| Tool | Description | Parameters | Mode Restriction |
|------|-------------|------------|------------------|
| `execute_python_code` | Execute Python code | `{ code: string }` | Agent (auto) |
| `inspect_variable` | Get variable metadata | `{ name: string }` | Agent (auto) |
| `list_variables` | List all variables | `{}` | Agent (auto) |
| `get_variable_sample` | Sample DataFrame rows | `{ name: string, rows?: number }` | Agent (auto) |
| `install_package` | Install via uv pip | `{ package: string }` | Agent (auto) |
| `read_file` | Read file contents | `{ path: string }` | Agent (auto) |
| `write_file` | Write file contents | `{ path: string, content: string }` | Agent (auto) |

### Tool Call Flow

```
AI: "I'll load your CSV file and show the first few rows."
    │
    └──▶ tool_call: execute_python_code({ code: "df = pd.read_csv('data.csv'); print(df.head())" })
              │
              ├─── Mode: Chat → Show preview, user clicks [Execute]
              │
              └─── Mode: Agent → Execute with confirmation, return result
```

---

## 4. Skill System

### Skill Sources

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Skill System Sources                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Bundled Skills (shipped with PyIDE)                                      │
│     Location: apps/desktop/src/skills/bundled/                               │
│     - /eda         Exploratory Data Analysis                                 │
│     - /clean       Data Cleaning                                             │
│     - /viz         Visualization                                             │
│     - /model       ML Model Training                                         │
│     - /sql         SQL Query Generation                                      │
│     - /debug       Debugging Assistant                                       │
│     - /perf        Performance Optimization                                  │
│     - /report      Report Generation                                         │
│                                                                              │
│  2. User Skills (per-project, markdown files)                               │
│     Location: .pyide/skills/*.md                                             │
│     Created by users for project-specific workflows                          │
│                                                                              │
│  3. ClawHub Registry (external, community)                                   │
│     URL: https://clawhub.io (or self-hosted)                                │
│     Install: %skill install clawhub:financial-analysis                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Skill File Format (Markdown)

```markdown
---
name: eda
description: Exploratory Data Analysis assistant
triggers:
  - on_dataframe_load: true    # Auto-trigger when DataFrame is created
  - on_command: /eda
allowed_tools:
  - inspect_variable
  - list_variables
  - get_variable_sample
  - execute_python_code
denied_tools: []
model: null                     # Optional: override default model
---

You are an expert data analyst. Your task is to help users explore and understand their datasets.

When a DataFrame is loaded:
1. Display basic info (shape, columns, dtypes)
2. Show missing value summary
3. Suggest 3-5 relevant visualizations based on data types
4. Identify potential data quality issues

Always explain your reasoning. Use clear visualizations.
```

### Skill Lock File

```json
// .pyide/.skill-lock.json
{
  "skills": {
    "eda": {
      "source": "bundled",
      "version": "1.0.0",
      "integrity": "sha256-abc123..."
    },
    "financial-analysis": {
      "source": "clawhub",
      "url": "https://clawhub.io/skills/financial-analysis",
      "version": "2.1.0",
      "integrity": "sha256-def456...",
      "installed_at": "2026-04-01T10:00:00Z"
    },
    "project-etl": {
      "source": "local",
      "path": ".pyide/skills/etl.md",
      "integrity": "sha256-ghi789..."
    }
  }
}
```

### Skill Auto-Triggers

| Trigger | Condition | Action |
|---------|-----------|--------|
| `on_dataframe_load` | `DataFrame` created in kernel | Suggest `/eda` skill |
| `on_error` | Exception raised | Suggest `/debug` skill |
| `on_import_sklearn` | `import sklearn` executed | Suggest `/model` skill |
| `on_sql_connection` | SQL connection established | Suggest `/sql` skill |

### Skill Commands

```python
%skill install clawhub:financial-analysis
%skill update financial-analysis
%skill list
%skill remove financial-analysis
```

### ClawHub Registry Integration (Phase 4)

ClawHub (clawhub.io) is the external community skill registry for PyIDE.

**Features:**
- Browse and search community skills at clawhub.io
- Install command: `%skill install clawhub:<skill-name>`
- Skills downloaded to `.pyide/skills/` directory
- Version tracking in `.pyide/.skill-lock.json`
- Update command: `%skill update clawhub:<skill-name>`
- List installed: `%skill list` (shows source: bundled/disk/clawhub)

**API Client:**
- GET https://clawhub.io/api/v1/skills — list/search skills
- GET https://clawhub.io/api/v1/skills/{name} — get skill metadata
- GET https://clawhub.io/api/v1/skills/{name}/download — download skill .md file

**Lock File Format (.pyide/.skill-lock.json):**
```json
{
  "skills": [{
    "name": "financial-analysis",
    "version": "1.2.0",
    "source": "clawhub",
    "url": "https://clawhub.io/skills/financial-analysis",
    "integrity": "sha256-...",
    "installed_at": "2026-04-07T12:00:00Z"
  }]
}
```

**UI:** "Install from ClawHub" button in SkillsPanel opens browse/search dialog

---

## 5. MCP Integration

### MCP Overview

MCP (Model Context Protocol) allows the AI to interact with external tools and data sources through a standardized interface.

### Transport Types

| Transport | Use Case | Deployment Location |
|-----------|----------|---------------------|
| `stdio` | Local CLI tools | Desktop (Tauri manages process) |
| `sse` | HTTP Server-Sent Events | Server or Desktop |
| `http` | REST API | Server or Desktop |
| `ws` | WebSocket | Server or Desktop |
| `sdk` | Direct Python import | Server only |

### Hybrid Deployment Model

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         MCP Hybrid Deployment                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Server-side MCP Servers (run on PyIDE server)                              │
│  ─────────────────────────────────────────────                              │
│  - Database connectors (PostgreSQL, MySQL, MongoDB)                         │
│  - Cloud storage (S3, GCS)                                                  │
│  - Team collaboration tools (Slack, Jira)                                   │
│  - Team Memory access                                                       │
│  - Code publishing                                                          │
│                                                                              │
│  Client-side MCP Servers (run on user's machine, desktop only)              │
│  ─────────────────────────────────────────────────────────────              │
│  - Local file system                                                        │
│  - Local database connections (SQLite, local Postgres)                      │
│  - Git operations                                                           │
│  - System tools (shell, clipboard)                                          │
│                                                                              │
│  Why split?                                                                 │
│  - Data sovereignty: Sensitive data stays on server or client               │
│  - Latency: Local file operations are faster locally                        │
│  - Offline: Client-side MCP works without server connection                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### MCP Configuration

```json
// .pyide/mcp.json
{
  "servers": {
    "postgres-team": {
      "transport": "sse",
      "url": "https://mcp.pyide.internal/postgres",
      "run_on": "server",
      "credentials": {
        "strategy": "env",
        "env_var": "DB_CONNECTION_STRING"
      },
      "tools": {
        "query": "ask",
        "insert": "always_deny"
      }
    },
    "local-files": {
      "transport": "stdio",
      "command": "mcp-server-filesystem",
      "args": ["--root", "${PROJECT_DIR}"],
      "run_on": "client",
      "tools": {
        "read_file": "always_allow",
        "write_file": "ask"
      }
    },
    "slack-team": {
      "transport": "http",
      "url": "https://mcp.pyide.internal/slack",
      "run_on": "server",
      "credentials": {
        "strategy": "vault",
        "vault_path": "secret/data/slack"
      }
    }
  }
}
```

### Credential Management

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       MCP Credential Strategy                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Desktop (Local Mode):                                                       │
│  ─────────────────────                                                       │
│  - OS Keyring (Windows Credential Manager / macOS Keychain / Linux Secret)  │
│  - Encrypted file (~/.pyide/credentials.enc) as fallback                    │
│                                                                              │
│  Server (Remote Mode):                                                       │
│  ─────────────────────                                                       │
│  - Environment variables (DOCKER_ENV, K8S Secret)                           │
│  - Encrypted env file (.env.mcp)                                            │
│                                                                              │
│  Enterprise:                                                                 │
│  ───────────                                                                 │
│  - HashiCorp Vault                                                           │
│  - AWS Secrets Manager                                                       │
│  - Azure Key Vault                                                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Tool Permission Model

```
Permission      Behavior
────────────    ──────────────────────────────────────────────────────────────
always_allow    AI can call without user confirmation
ask             AI calls require user confirmation (default)
always_deny     Tool is blocked, AI cannot use it
```

### MCP Tool Calling in AI Chat (Phase 4)

When an AI response contains tool call patterns, ChatEngine parses and executes them:

**Tool Call Format:**
```
[TOOL_CALL: server_name.tool_name({"param": "value"})]
```

**Execution Flow:**
1. ChatEngine response handler scans AI output for [TOOL_CALL: ...] patterns
2. Parse server name, tool name, and JSON arguments
3. Check tool permissions (always_allow / ask / always_deny)
4. In Agent mode: execute with confirmation (respecting allowed_tools from active Skill)
5. Execute via MCPClient.callTool(server, tool, args)
7. Format result and inject back into conversation as tool_result message
8. AI continues with tool result context

**Implementation Files:**
- ChatEngine.ts: Response handler with tool call parser
- MCPService/chatIntegration.ts: Tool execution bridge
- MCPService/client.ts: callTool() method

---

## 6. Multi-Agent System

### Agent Types

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Multi-Agent System                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Main Agent (Primary)                                                        │
│  ─────────────────────                                                       │
│  - User-facing conversation                                                  │
│  - Plans tasks and delegates to Worker Agents                               │
│  - Has access to all allowed tools                                          │
│                                                                              │
│  Worker Agents (Spawned by Main Agent)                                      │
│  ────────────────────────────────────                                       │
│  - Execute specific subtasks                                                │
│  - Have restricted tool access (configured per-agent)                       │
│  - Cannot spawn more agents (can_spawn_agents: false)                       │
│                                                                              │
│  Background Agents (Always running)                                          │
│  ─────────────────────────────────────                                       │
│  - Session Memory Extractor: Monitors conversation, extracts memories       │
│  - Code Reviewer: Reviews code before execution (optional)                  │
│  - Data Monitor: Watches for data anomalies (optional)                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Agent Configuration

```typescript
interface AgentConfig {
  id: string;
  name: string;
  system_prompt: string;
  
  // Tool restrictions
  allowed_tools: string[];      // Subset of all available tools
  denied_tools: string[];       // Explicitly blocked tools
  
  // Kernel access
  kernel_access: "full" | "read_only" | "none";
  
  // Execution limits
  max_tokens: number;           // Max response tokens
  max_execution_time: number;   // Timeout in seconds
  
  // Spawning
  can_spawn_agents: false;      // Workers cannot spawn more agents
}
```

### Agent Communication

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       Agent Communication Methods                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Shared Kernel Namespace                                                  │
│     - Worker agents operate on same kernel variables                        │
│     - Main agent can see worker's results in variables                      │
│     - Requires kernel_access != "none"                                      │
│                                                                              │
│  2. Message Queue                                                            │
│     - Internal message bus for agent-to-agent communication                 │
│     - Workers report status back to Main Agent                              │
│     - Main Agent aggregates results                                         │
│                                                                              │
│  3. File Exchange                                                            │
│     - Write results to temp files                                           │
│     - Other agents read from files                                          │
│     - Useful for large outputs (datasets, models)                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Independent Session History

Each agent maintains its own `messages[]` array:

```typescript
// Main Agent
const mainAgentMessages = [
  { role: "user", content: "Train a model on my data" },
  { role: "assistant", content: "I'll spawn a worker for preprocessing..." },
  { role: "assistant", tool_calls: [{ name: "spawn_agent", params: {...} }] }
];

// Worker Agent (Preprocessing)
const workerMessages = [
  { role: "system", content: "You are a data preprocessing specialist..." },
  { role: "user", content: "Preprocess the DataFrame 'df'" },
  // ... worker's own conversation
];
```

### Multi-Agent Implementation (Phase 4)

**AI Mode Switching:**
- Chat mode (default): AI suggests code, user clicks to execute
- Agent mode: Full autonomy, executes tools with confirmation, respects allowed_tools/denied_tools
- Mode selector in chat UI header

**Agent Types:**
- Main Agent: User-facing, plans tasks, delegates to workers
- Worker Agents: Spawned by main agent, restricted tool access, cannot spawn more agents
- Background Agents:
  - Session Memory Extractor (already implemented)
  - Code Reviewer (optional, on-demand)
  - Data Monitor (optional, watches variable changes)

**Agent Communication:**
- Shared kernel namespace (all agents can read/write variables)
- Message queue for inter-agent communication
- File exchange via workspace directory
- Independent session history per agent

**Cost Tracking:**
- Per-agent token usage tracking (input/output tokens)
- Aggregated total displayed in status bar
- Cost limits configurable per session

**Implementation Files:**
- services/AgentManager.ts: Agent lifecycle management
- services/ChatEngine.ts: Mode switching, tool permissions
- stores/chatStore.ts: Multi-agent state, cost tracking

### Cost Aggregation

```typescript
interface AggregatedCost {
  main_agent: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  };
  worker_agents: {
    [agent_id: string]: {
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
    };
  };
  total_cost_usd: number;
}

// UI displays aggregated cost, expandable to show per-agent breakdown
```

---

## 7. API Configuration

### OpenAI-Compatible Format

```typescript
interface AIProviderConfig {
  // All providers use this format
  provider: "openai" | "anthropic" | "openai_compatible";
  base_url: string;
  api_key: string;
  model_id: string;
  
  // Optional per-provider extras
  extra_headers?: Record<string, string>;
  default_params?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  };
}
```

### Example Configurations

```json
// OpenAI
{
  "provider": "openai",
  "base_url": "https://api.openai.com/v1",
  "api_key": "${OPENAI_API_KEY}",
  "model_id": "gpt-4o"
}

// Anthropic (via OpenAI-compatible proxy like LiteLLM)
{
  "provider": "anthropic",
  "base_url": "https://api.anthropic.com/v1",
  "api_key": "${ANTHROPIC_API_KEY}",
  "model_id": "claude-sonnet-4-20250514"
}

// Local Ollama
{
  "provider": "openai_compatible",
  "base_url": "http://localhost:11434/v1",
  "api_key": "ollama",
  "model_id": "llama3.1:70b"
}

// Azure OpenAI
{
  "provider": "openai_compatible",
  "base_url": "https://your-resource.openai.azure.com/openai/deployments/gpt-4o",
  "api_key": "${AZURE_OPENAI_KEY}",
  "model_id": "gpt-4o",
  "extra_headers": {
    "api-key": "${AZURE_OPENAI_KEY}"
  }
}
```

### Storage

```
Desktop:
  - API keys stored in OS Keyring
  - Config in ~/.pyide/settings.json

Server:
  - API keys in environment variables
  - Config in database (per-user settings)
```
