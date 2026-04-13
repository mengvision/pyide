# PyIDE Design Documentation

> Target audience: developers building PyIDE from scratch.  
> License: MIT  
> Stack: Tauri + React 18 + TypeScript (desktop) · FastAPI + Python (server)

---

## Document Index

| # | Document | Content |
|---|----------|---------|
| 01 | [Project Overview & Architecture](./01-overview.md) | Goals, system architecture, monorepo structure, deployment model |
| 02 | [Python Kernel](./02-kernel.md) | PyKernel design, dual-mode, cell format, magic commands, checkpoints, persistence |
| 03 | [AI Chat, Skill System & MCP](./03-ai-chat-skill-mcp.md) | AI chat modes, skill system, MCP integration, multi-agent |
| 04 | [Memory System](./04-memory-system.md) | 4-layer memory, compression, Dream Mode, Idle Dream Mode |
| 05 | [Frontend UI](./05-frontend-ui.md) | Layout, tech stack, editor, output, panels, shortcuts |
| 06 | [Multi-User & Code Publishing](./06-multi-user-publishing.md) | Auth, workspace isolation, resource management, publishing, Git |
| 07 | [Development Roadmap](./07-development-roadmap.md) | Phase 1 MVP, Phase 2, Phase 3, Phase 4 scope |
| 08 | [Testing Documentation](./TESTING.md) | Test suites, scripts, checklists, troubleshooting |

---

## Quick Reference: Key Decisions

```
Item                  Decision
────────────────────  ─────────────────────────────────────────────────────────
Project name          PyIDE
License               MIT
Desktop framework     Tauri (Rust backend + WebView)
Frontend              React 18 + TypeScript + Monaco Editor + Zustand
Server backend        FastAPI (Python)
Kernel approach       Custom PyKernel (no Jupyter dependency)
Cell delimiter        #%% (Spyder-style .py files, not .ipynb)
Local kernel comm     WebSocket ws://127.0.0.1
Remote kernel comm    WebSocket wss:// (TLS encrypted)
Env management        uv (local + remote)
AI API format         OpenAI-compatible (base_url + api_key + model)
Memory storage        Markdown files + JSON metadata
Vector search         Deferred (MVP uses keyword matching only)
Multi-user target     5–20 person teams, private deployment
Open source           MIT, monorepo on GitHub
```
