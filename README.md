# PyIDE

A modern Python IDE with local and remote kernel modes — built with Tauri, React, and FastAPI.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- **Dual Kernel Modes** — Local Python kernel (zero setup) or remote kernel via server
- **REPL-style Console** — `In [1]` / `Out [1]` prompts with persistent history
- **Monaco Editor** — Full-featured code editor with `#%%` cell support (Spyder-style)
- **AI Chat Integration** — Built-in AI assistant for coding help
- **Multi-user Remote Deployment** — Server mode supports 5–20 person teams
- **MCP Support** — Model Context Protocol for tool extensibility
- **Skills System** — Composable, extensible AI workflows
- **Memory System** — Persistent context across sessions
- **Variable Explorer** — Inspect live Python variables
- **DataFrame & Chart Visualization** — View tables and plots inline

## 🚀 Quick Start

### Option 1: Server Deployment (One-liner)

Deploy the full server stack with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/mengvision/pyide/main/scripts/install.sh | bash
```

With custom options:

```bash
curl -fsSL https://raw.githubusercontent.com/mengvision/pyide/main/scripts/install.sh | bash -s -- --api-port 9000 --ip 192.168.1.100
```

> Requires Docker & Docker Compose. Installs FastAPI server + PostgreSQL + Redis.

### Option 2: Desktop Client (Local Mode)

Clone and run the desktop app — works out of the box with a local Python kernel, no server needed:

```bash
git clone https://github.com/mengvision/pyide.git
cd pyide
npm install
cd apps/desktop
npx tauri dev
```

**Prerequisites:** Node.js 18+, Rust toolchain, Python 3.12+, [uv](https://github.com/astral-sh/uv)

### Remote Mode Setup

1. Deploy the server (see Option 1 above)
2. Launch the desktop client
3. Go to **Settings → Server URL** and enter your server address
4. Switch to **Remote** mode and log in

## 📁 Project Structure

```
pyide/
├── apps/
│   ├── desktop/          # Tauri + React 18 desktop app
│   └── web/              # Web frontend (browser-based client)
├── packages/
│   ├── server/           # FastAPI backend (Python 3.12)
│   ├── pykernel/         # Custom Python kernel (non-Jupyter)
│   ├── protocol/         # Shared message protocol types
│   └── platform/         # Shared platform utilities
├── scripts/
│   ├── install.sh        # One-click server deployment
│   └── uninstall.sh      # Clean uninstall
└── docs/                 # Full documentation
```

## 🔧 Development

### Prerequisites

- Node.js 18+
- Rust (for Tauri)
- Python 3.12+
- [uv](https://github.com/astral-sh/uv) (Python environment manager)
- Docker & Docker Compose (for server)

### Install & Run

```bash
# Install all JS dependencies
npm install

# Start desktop app (local kernel mode)
cd apps/desktop
npx tauri dev

# Start web frontend only
cd apps/web
npm run dev

# Start backend server (development)
cd packages/server
uv sync
uv run uvicorn main:app --reload

# Install local kernel package
cd packages/pykernel
pip install -e .
```

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Overview](docs/01-overview.md) | Project architecture overview |
| [Kernel](docs/02-kernel.md) | PyKernel internals |
| [AI / Chat / MCP](docs/03-ai-chat-skill-mcp.md) | AI integration guide |
| [Memory System](docs/04-memory-system.md) | Persistent memory system |
| [Frontend UI](docs/05-frontend-ui.md) | UI component guide |
| [Multi-user Deployment](docs/06-multi-user-publishing.md) | Team deployment guide |
| [Server Deployment](docs/SERVER_DEPLOYMENT_GUIDE.md) | Detailed server setup |
| [Authentication](docs/AUTHENTICATION_CONFIGURATION.md) | Auth configuration |

## 🗑️ Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/mengvision/pyide/main/scripts/uninstall.sh | bash
```

## 📄 License

[MIT](LICENSE) © [mengvision](https://github.com/mengvision)
