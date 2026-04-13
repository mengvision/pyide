# 01 · Project Overview & Architecture

## 1. Project Goal

PyIDE is an open-source, AI-native Python IDE designed for **data scientists and ML engineers** on small-to-medium teams (5–20 people). It combines a notebook-style interactive execution environment with a powerful AI assistant, skill system, memory system, and MCP integration — all packaged as a desktop application with optional server-side remote kernels.

**Core design principles:**
- Plain `.py` files with `#%%` cell delimiters (Git-friendly, no `.ipynb`)
- AI that can directly execute code in the kernel, not just suggest it
- Neuroscience-inspired memory system that learns from every session
- No Jupyter dependency — custom lightweight Python kernel
- Private deployment first; enterprise teams own their data

---

## 2. Target Users

| User Type | Primary Needs |
|-----------|---------------|
| Data Analyst | Interactive data exploration, SQL execution, charts, AI-assisted EDA |
| ML Engineer | Model training, GPU access, remote kernel, reproducible environments |
| Team Lead / Admin | Multi-user management, resource quotas, team memory, audit |

---

## 3. High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           PyIDE System Architecture                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Desktop App (Tauri)                                                   │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │  Frontend (React 18 + TypeScript + Monaco Editor)                │  │  │
│  │  │  Zustand state · AG Grid · Plotly · VSCode Codicons              │  │  │
│  │  └────────────────────────┬─────────────────────────────────────────┘  │  │
│  │                           │  Tauri IPC                                 │  │
│  │  ┌────────────────────────▼─────────────────────────────────────────┐  │  │
│  │  │  Rust Backend (Tauri Core)                                        │  │  │
│  │  │  uv Manager · Local MCP (stdio) · Keyring · File System          │  │  │
│  │  └────────────────────────┬─────────────────────────────────────────┘  │  │
│  └───────────────────────────│────────────────────────────────────────────┘  │
│                              │                                               │
│           ws://127.0.0.1     │      wss://your-server                        │
│                              │                                               │
│  ┌───────────────────────────▼────────────────────────────────────────────┐  │
│  │  Kernel Layer                                                          │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────┐   ┌──────────────────────────────┐   │  │
│  │  │  LOCAL MODE                 │   │  REMOTE MODE                 │   │  │
│  │  │  Custom PyKernel            │   │  Remote Kernel Proxy         │   │  │
│  │  │  (subprocess, uv venv)      │   │  (FastAPI server + cgroups)  │   │  │
│  │  │  ws://127.0.0.1:PORT        │   │  wss://host/kernel/{user_id} │   │  │
│  │  └─────────────────────────────┘   └──────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  PyIDE Server (FastAPI · Python)                                       │  │
│  │                                                                        │  │
│  │  Auth API · User Management · Kernel Manager · Memory API             │  │
│  │  Skill Registry · MCP Proxy · Publishing API · Admin Panel API        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Storage Layer                                                         │  │
│  │  PostgreSQL (users/auth/publish)  ·  SQLite (per-user memory/skills)  │  │
│  │  File system (workspaces/checkpoints/dreams)                          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Monorepo Structure

```
pyide/                              # Root (MIT License)
├── apps/
│   ├── desktop/                    # Tauri desktop application
│   │   ├── src/                    # React frontend entry
│   │   └── src-tauri/              # Rust backend
│   │       ├── src/
│   │       │   ├── main.rs
│   │       │   ├── kernel.rs       # Local PyKernel process management
│   │       │   ├── uv.rs           # uv CLI wrapper
│   │       │   ├── mcp.rs          # Local MCP stdio process management
│   │       │   └── keyring.rs      # OS keyring access
│   │       └── tauri.conf.json
│   │
│   ├── server/                     # PyIDE server (remote kernel host)
│   │   ├── pyide_server/
│   │   │   ├── main.py             # FastAPI app entry
│   │   │   ├── auth/               # JWT auth, user management
│   │   │   ├── kernel/             # Kernel manager, process pool, cgroups
│   │   │   ├── memory/             # Memory API, Dream Mode scheduler
│   │   │   ├── skills/             # Skill registry, ClawHub client
│   │   │   ├── mcp/                # Server-side MCP proxy
│   │   │   ├── publish/            # Code publishing, version snapshots
│   │   │   └── admin/              # Admin panel API
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   │
│   └── admin/                      # Admin web panel (separate React app)
│       └── src/
│
├── packages/
│   ├── ui/                         # Shared React components
│   │   ├── editor/                 # Monaco wrapper, cell rendering
│   │   ├── output/                 # Output renderers (text/table/chart/error)
│   │   ├── panels/                 # Variables, Plots, AI Chat, Environment
│   │   └── common/                 # Buttons, icons, layout primitives
│   │
│   ├── kernel-client/              # Kernel WebSocket client (shared TS)
│   │   ├── KernelClient.ts         # Connects to local or remote kernel
│   │   ├── protocol.ts             # Message type definitions
│   │   └── OutputParser.ts         # Parse kernel output into render types
│   │
│   ├── pykernel/                   # Custom Python kernel (runs as subprocess)
│   │   ├── pykernel/
│   │   │   ├── __main__.py         # Entry: python -m pykernel --port PORT
│   │   │   ├── executor.py         # Code execution engine
│   │   │   ├── state_manager.py    # Variable namespace management
│   │   │   ├── magic_handler.py    # Magic command dispatcher
│   │   │   ├── cell_parser.py      # #%% cell parsing
│   │   │   ├── sql_engine.py       # %%sql cell execution
│   │   │   ├── checkpoint.py       # State persistence (dill-based)
│   │   │   └── ws_server.py        # WebSocket transport
│   │   └── pyproject.toml
│   │
│   ├── ai/                         # AI Chat, Skill, Memory client logic (TS)
│   │   ├── ChatEngine.ts
│   │   ├── SkillManager.ts
│   │   ├── MemoryClient.ts
│   │   └── AgentOrchestrator.ts
│   │
│   └── protocol/                   # Shared type definitions
│       ├── kernel.ts               # KernelMessage, ExecuteRequest/Reply
│       ├── memory.ts               # MemoryEntry, DreamReport
│       ├── skill.ts                # SkillDefinition, SkillLock
│       └── mcp.ts                  # MCPServerConfig, MCPToolCall
│
├── docker/
│   ├── docker-compose.yml          # Full server deployment
│   ├── docker-compose.dev.yml      # Local development
│   └── Dockerfile.server
│
├── deploy/
│   ├── .env.example
│   └── nginx.conf.example
│
└── docs/                           # This documentation
```

---

## 5. Deployment Model

### Self-Hosted (Primary)

```
# 1. Copy docker-compose.yml
curl -O https://github.com/your-org/pyide/releases/latest/download/docker-compose.yml

# 2. Configure environment
cp .env.example .env
# Edit: SECRET_KEY, POSTGRES_PASSWORD, ADMIN_EMAIL, SERVER_URL

# 3. Start
docker compose up -d

# 4. First-run setup
# Visit http://localhost:3000/admin to create users
# Users download desktop app and connect to http://your-server:3000
```

### Services started by docker-compose

| Service | Port | Description |
|---------|------|-------------|
| `pyide-server` | 8000 | FastAPI backend (API + kernel manager) |
| `pyide-admin` | 3000 | Admin web panel |
| `postgres` | 5432 | Main database |
| `redis` | 6379 | Session cache + task queue |

### Desktop App Connection

Users install the Tauri desktop app (`.exe` / `.dmg` / `.AppImage`). On first launch they enter the server URL. The app authenticates via JWT and can then:
- Start a **local kernel** (ws://127.0.0.1, managed by Tauri/Rust)
- Connect to a **remote kernel** (wss://server/kernel/{session_id})

---

## 6. Data Flow: Remote Kernel (Zero Local Data Policy)

```
User (Desktop) ──── wss:// ────▶ PyIDE Server ──── subprocess ──▶ PyKernel
                                      │
                               Data stays on server
                               (CSV, DB, models — never downloaded)
                                      │
                               Only outputs returned:
                               - text/stdout
                               - rendered charts (SVG/HTML)
                               - DataFrame preview (first N rows, configurable)
                               - variable metadata (name, type, shape, size)
```

Sensitive data (full DataFrame, raw files, model weights) **never leaves the server**.

---

## 7. Technology Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop shell | Tauri 2 (Rust) | Smaller bundle vs Electron, native OS APIs, system WebView |
| Frontend | React 18 + TypeScript | Component model, strong ecosystem |
| Editor | Monaco Editor (standalone) | VS Code editing quality without forking Code-OSS |
| State management | Zustand | Lightweight, no boilerplate |
| Data tables | AG Grid Community | Virtual scroll, handles 100k+ rows |
| Charts | Plotly.js (native) | Interactive, data science standard |
| Icons | VSCode Codicons | Consistent with Code-OSS feel |
| Styling | CSS Modules + CSS Variables | No runtime overhead, easy theming |
| Server | FastAPI (Python 3.11+) | Async, OpenAPI docs, same ecosystem as kernel |
| Database | PostgreSQL | Users, publishing, audit logs |
| Cache/Queue | Redis | JWT blacklist, task queue for Dream Mode |
| Kernel | Custom PyKernel (Python) | No Jupyter dependency, full control |
| Serialization | dill | Supports lambda, closures, custom classes |
| Env management | uv | Fast, modern, replaces pip/venv/pyenv |
| IPC (local) | WebSocket ws://127.0.0.1 | Unified protocol with remote mode |
| Transport (remote) | WebSocket wss:// | Encrypted, bidirectional streaming |
