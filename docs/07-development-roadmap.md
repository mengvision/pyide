# 07 · Development Roadmap

## Phase Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       Development Phases                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: MVP Desktop (Local Kernel)                                        │
│  ─────────────────────────────────────                                      │
│  Target: 3–4 months                                                          │
│  Goal: Single-user desktop app with local Python kernel, AI chat,           │
│        basic skill system, and memory                                        │
│                                                                              │
│  Phase 2: Full Desktop Features                                             │
│  ─────────────────────────────────                                          │
│  Target: 2–3 months                                                          │
│  Goal: Complete local mode — all cell types, magic commands, Git,           │
│        MCP, full Dream Mode                                                 │
│                                                                              │
│  Phase 3: Remote Kernel & Multi-User                          [In Progress] │
│  ─────────────────────────────────                                          │
│  Target: 2–3 months                                                          │
│  Goal: Server-side deployment, remote kernel, user management,              │
│        code publishing, Team Memory                                         │
│                                                                              │
│  Phase 4: Feature Completion + Polish                                       │
│  ────────────────────────────────────                                       │
│  Target: 2–3 months                                                          │
│  Goal: Checkpoint system, full magic commands, MCP tool calling,            │
│        ClawHub marketplace, multi-agent AI, UX polish                       │
│                                                                              │
│  Phase 5: Web Version (Optional)                                            │
│  ─────────────────────────────                                              │
│  Target: 1–2 months                                                          │
│  Goal: Browser-based version of PyIDE (no desktop app required)             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: MVP Desktop (Local Kernel)

**Duration:** 3–4 months  
**Goal:** Functional single-user desktop app

### Core Features

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Phase 1 Checklist                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Project Skeleton                                                         │
│     [ ] Initialize Tauri project                                            │
│     [ ] Set up React + TypeScript + Vite                                    │
│     [ ] Configure Zustand stores                                            │
│     [ ] Set up CSS Modules + theme variables                                │
│     [ ] Configure ESLint + Prettier                                         │
│                                                                              │
│  2. Editor & Cell System                                                     │
│     [ ] Monaco Editor integration                                           │
│     [ ] #%% cell parsing and rendering                                      │
│     [ ] Cell type indicators (Python/SQL/Bash)                              │
│     [ ] Cell hover toolbar (Run/Stop)                                       │
│     [ ] Multiple file tabs                                                  │
│                                                                              │
│  3. Local Kernel                                                             │
│     [ ] PyKernel subprocess management (Rust/Tauri)                         │
│     [ ] WebSocket client (ws://127.0.0.1)                                   │
│     [ ] execute / interrupt / inspect protocol                              │
│     [ ] Output parsing (text/dataframe/chart/error)                         │
│                                                                              │
│  4. uv Integration                                                           │
│     [ ] Rust wrapper for uv CLI                                             │
│     [ ] Create/delete/list venvs                                            │
│     [ ] Install/uninstall packages                                          │
│     [ ] Environment selector UI                                             │
│                                                                              │
│  5. Output Rendering                                                         │
│     [ ] Text output component                                                │
│     [ ] AG Grid for DataFrame display                                       │
│     [ ] Plotly chart rendering                                              │
│     [ ] Error display with [AI Fix] button                                  │
│                                                                              │
│  6. AI Chat (Chat Mode Only)                                                │
│     [ ] OpenAI-compatible API client                                        │
│     [ ] Streaming response handling                                         │
│     [ ] Code block rendering with [Execute] button                          │
│     [ ] Context injection (kernel state)                                    │
│                                                                              │
│  7. Variables Panel                                                          │
│     [ ] List variables from kernel                                          │
│     [ ] Tree view for nested objects                                        │
│     [ ] Variable inspection on click                                        │
│                                                                              │
│  8. Basic UI Layout                                                          │
│     [ ] 4-panel layout (Left/Editor/Output/Right)                           │
│     [ ] Left sidebar: Files only                                            │
│     [ ] Right panel: Variables + AI Chat tabs                               │
│     [ ] Status bar (kernel status, Python version)                          │
│                                                                              │
│  9. File Management                                                          │
│     [ ] File tree browser                                                    │
│     [ ] Create/rename/delete files                                          │
│     [ ] Save/load .py files                                                 │
│     [ ] Recent files list                                                   │
│                                                                              │
│  10. Settings                                                                 │
│      [ ] Settings UI                                                         │
│      [ ] AI provider configuration (base_url, api_key, model)               │
│      [ ] Theme toggle (dark/light)                                          │
│      [ ] Vim mode toggle                                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1 Scope Exclusions

- ❌ Remote kernel (Phase 3)
- ❌ Multi-user (Phase 3)
- ❌ `%%sql`, `%%bash` cells (Phase 2)
- ❌ Magic commands beyond `%pip` (Phase 2)
- ❌ Checkpoint persistence (Phase 2)
- ❌ Skill auto-triggers (Phase 2)
- ❌ MCP integration (Phase 2)
- ❌ Dream Mode (Phase 2)
- ❌ Memory compression (Phase 2)
- ❌ Code publishing (Phase 3)
- ❌ Git integration (Phase 2)

---

## Phase 2: Full Desktop Features

**Duration:** 2–3 months  
**Goal:** Complete local-mode feature set

### Features

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Phase 2 Checklist                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Cell Types                                                               │
│     [ ] %%sql cell execution                                                │
│         [ ] Connection string parsing                                        │
│         [ ] Variable interpolation {{var}} → parameterized query            │
│         [ ] Result → DataFrame                                              │
│     [ ] %%bash cell execution                                               │
│     [ ] %%markdown rendering                                                │
│                                                                              │
│  2. Magic Commands                                                           │
│     [ ] Magic handler in PyKernel                                           │
│     [ ] %pip install/uninstall                                              │
│     [ ] %pyenv version switch                                               │
│     [ ] %env set/get                                                        │
│     [ ] %ai model switch                                                    │
│     [ ] %time execution                                                     │
│     [ ] %checkpoint save/restore/list                                       │
│     [ ] %who / %whos / %reset                                               │
│     [ ] ! shell escape                                                      │
│                                                                              │
│  3. State Persistence                                                        │
│     [ ] Checkpoint serialization (dill)                                     │
│     [ ] Hot state auto-save (every 60s)                                     │
│     [ ] Session checkpoint on idle                                          │
│     [ ] Project snapshot                                                    │
│     [ ] Single variable restore                                             │
│                                                                              │
│  4. Skill System                                                             │
│     [ ] Bundled skills (/eda, /clean, /viz, /model, /debug)                 │
│     [ ] Skill file format parsing (YAML + Markdown)                         │
│     [ ] Skill activation UI                                                 │
│     [ ] Auto-trigger on DataFrame load                                      │
│     [ ] Auto-trigger on error                                               │
│     [ ] .skill-lock.json management                                         │
│     [ ] ClawHub install from registry                                        │
│                                                                              │
│  5. AI Chat Modes                                                            │
│     [ ] Assist mode (read-only auto, write needs confirm)                   │
│     [ ] Agent mode (full auto-execute)                                      │
│     [ ] Tool call handling                                                  │
│         [ ] execute_python_code                                              │
│         [ ] inspect_variable                                                │
│         [ ] list_variables                                                  │
│         [ ] get_variable_sample                                             │
│                                                                              │
│  6. MCP Integration (Local Only)                                            │
│     [ ] MCP config file parsing                                             │
│     [ ] stdio transport (Tauri subprocess)                                  │
│     [ ] Tool discovery                                                      │
│     [ ] Tool call handling                                                  │
│     [ ] Permission model (always_allow/ask/always_deny)                     │
│     [ ] OS Keyring for credentials                                          │
│                                                                              │
│  7. Memory System (MVP)                                                      │
│     [ ] Session Memory extraction                                           │
│     [ ] Project Memory storage                                              │
│     [ ] User Memory storage                                                 │
│     [ ] Memory UI panel                                                     │
│     [ ] Memory search (keyword)                                             │
│     [ ] Pin/unpin entries                                                   │
│     [ ] Manual edit via file                                                │
│     [ ] Context injection into AI                                           │
│                                                                              │
│  8. Dream Mode                                                               │
│     [ ] Session counting                                                    │
│     [ ] Trigger condition check                                             │
│     [ ] N1: Weight scan                                                    │
│     [ ] N3: Memory transfer (Session→Project→User)                         │
│     [ ] REM-C: Contradiction detection                                     │
│     [ ] Wake: Dream report generation                                       │
│     [ ] Dream report UI                                                     │
│     [ ] Idle Dream Mode (REM-C only, silent)                               │
│                                                                              │
│  9. Memory Compression                                                       │
│     [ ] Size/count threshold check                                          │
│     [ ] Keyword clustering                                                  │
│     [ ] Merge and summarize                                                 │
│                                                                              │
│  10. Git Integration (Phase 2)                                               │
│      [ ] Initialize repo for new project                                    │
│      [ ] Git panel in sidebar (status, diff, history)                       │
│      [ ] Commit UI                                                          │
│      [ ] %share auto-commit                                                 │
│      [ ] Optional remote push                                               │
│                                                                              │
│  11. Additional UI                                                           │
│      [ ] Plots panel                                                        │
│      [ ] Environment panel                                                  │
│      [ ] Skills panel in sidebar                                            │
│      [ ] MCP panel in sidebar                                               │
│      [ ] Memory panel in sidebar                                            │
│      [ ] Command palette (Ctrl+Shift+P)                                     │
│      [ ] Keyboard shortcuts (Spyder-aligned)                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Remote Kernel & Multi-User — **[In Progress]**

**Duration:** 2–3 months  
**Goal:** Server deployment, multi-user, code publishing

### Features

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Phase 3 Checklist                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Server Skeleton                                                          │
│     [ ] FastAPI project setup                                               │
│     [ ] PostgreSQL schema                                                   │
│     [ ] Redis connection                                                    │
│     [ ] Docker Compose configuration                                        │
│                                                                              │
│  2. Authentication                                                           │
│     [ ] User model (username, password hash, role)                          │
│     [ ] JWT token generation/validation                                     │
│     [ ] Login/logout API                                                    │
│     [ ] Session management                                                  │
│     [ ] Password reset                                                      │
│                                                                              │
│  3. Remote Kernel Manager                                                    │
│     [ ] Kernel process pool                                                 │
│     [ ] Per-user kernel isolation                                           │
│     [ ] cgroups resource limits                                             │
│     [ ] GPU allocation                                                      │
│     [ ] Kernel lifecycle (start/stop/restart)                               │
│     [ ] Health monitoring                                                   │
│                                                                              │
│  4. Desktop App Remote Mode                                                 │
│     [ ] Remote kernel connection (wss://)                                   │
│     [ ] Login flow in desktop app                                           │
│     [ ] Kernel mode switch (local/remote)                                   │
│     [ ] State migration on switch                                           │
│                                                                              │
│  5. Workspace Isolation                                                      │
│     [ ] Per-user directory structure                                        │
│     [ ] File system permissions                                             │
│     [ ] API for file operations                                             │
│                                                                              │
│  6. Team Memory                                                              │
│     [ ] Team Memory storage (server)                                        │
│     [ ] Permission levels (public/dept/sensitive)                           │
│     [ ] Memory sync API                                                     │
│                                                                              │
│  7. Code Publishing                                                          │
│     [ ] Publishing API                                                      │
│     [ ] Output snapshot capture                                             │
│     [ ] Visibility levels (private/team/public)                             │
│     [ ] Published page rendering                                            │
│     [ ] Deep link (pyide://open)                                            │
│     [ ] Version snapshots                                                   │
│                                                                              │
│  8. Admin Panel                                                              │
│     [ ] Admin React app                                                     │
│     [ ] User management UI                                                  │
│     [ ] Resource monitoring                                                 │
│     [ ] Team Memory management                                              │
│     [ ] System settings                                                     │
│     [ ] Audit log viewer                                                    │
│                                                                              │
│  9. Server-Side MCP                                                          │
│     [ ] MCP proxy on server                                                 │
│     [ ] Environment variable credentials                                    │
│     [ ] Vault integration (optional)                                        │
│                                                                              │
│  10. Security                                                                │
│      [ ] HTTPS configuration                                                │
│      [ ] Rate limiting                                                      │
│      [ ] Audit logging                                                      │
│      [ ] Input validation                                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 4: Feature Completion + Polish

**Duration:** 2–3 months  
**Goal:** Checkpoint system, full magic commands, MCP tool calling, ClawHub marketplace, multi-agent AI, and UX polish

### Features

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Phase 4 Checklist                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Checkpoint System                                                        │
│     [ ] 3-layer checkpoint: hot state (auto), session, project              │
│     [ ] dill serialization for full kernel state                            │
│     [ ] %checkpoint save / restore / list magic commands                   │
│     [ ] Frontend Checkpoint Manager UI                                      │
│                                                                              │
│  2. Full Magic Commands                                                      │
│     [ ] %env (environment variable get/set)                                 │
│     [ ] %time (cell timing)                                                 │
│     [ ] %who / %whos (variable listing)                                     │
│     [ ] %reset (kernel state reset)                                         │
│     [ ] %memory (memory panel control)                                      │
│     [ ] %kernel (kernel management)                                         │
│     [ ] %share (publish/share code)                                         │
│     [ ] %ai (model/mode switch)                                             │
│     [ ] %%sql (SQL cell execution)                                          │
│     [ ] %%bash (shell cell execution)                                       │
│     [ ] %%time (cell-level timing block)                                    │
│     [ ] %%markdown (markdown rendering cell)                                │
│     [ ] ! command (shell escape)                                            │
│                                                                              │
│  3. MCP Tool Calling in AI Chat                                              │
│     [ ] Parse AI responses for tool call patterns                           │
│     [ ] Execute tool calls via MCPClient                                    │
│     [ ] Inject tool results back into conversation                          │
│     [ ] Assist mode: confirm before executing                               │
│     [ ] Agent mode: fully automatic execution                               │
│                                                                              │
│  4. ClawHub Skill Marketplace                                                │
│     [ ] API client for clawhub.io                                           │
│     [ ] %skill install clawhub:<name> command                               │
│     [ ] Download skills to .pyide/skills/                                   │
│     [ ] Versioning with .skill-lock.json                                    │
│     [ ] Browse/search skill UI dialog                                       │
│                                                                              │
│  5. Multi-Agent AI System                                                    │
│     [ ] Main / Worker / Background agent roles                              │
│     [ ] AI modes: Chat / Assist / Agent                                     │
│     [ ] Agent communication via shared kernel context                       │
│     [ ] Cost tracking per agent/session                                     │
│                                                                              │
│  6. UX Polish                                                                │
│     [ ] Chat history persistence (localStorage / IndexedDB)                 │
│     [ ] Cell delimiter visibility (Monaco decorations for #%%)              │
│     [ ] Settings expansion: custom shortcuts, themes, Vim toggle            │
│     [ ] Session revocation UI                                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 5: Web Version (Optional)

**Duration:** 1–2 months  
**Goal:** Browser-based PyIDE

### Features

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Phase 5 Checklist                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Web App Skeleton                                                         │
│     [ ] React SPA (no Tauri)                                                │
│     [ ] Replace Tauri IPC with REST API                                     │
│     [ ] Web Monaco Editor                                                   │
│                                                                              │
│  2. Authentication                                                           │
│     [ ] Web login flow                                                      │
│     [ ] Session cookies                                                     │
│                                                                              │
│  3. Remote Kernel Only                                                       │
│     [ ] WebSocket from browser                                              │
│     [ ] No local kernel support                                             │
│                                                                              │
│  4. Feature Parity                                                           │
│     [ ] All Phase 2/4 features except:                                      │
│         - Local MCP (stdio)                                                 │
│         - Local file system access                                          │
│         - Local uv management                                               │
│                                                                              │
│  5. Deployment                                                               │
│     [ ] Static hosting compatible (S3/CDN)                                  │
│     [ ] API server only                                                     │
│                                                                              │
│  6. Deferred: Git Integration                                                │
│     [ ] Sidebar Git panel (status, diff, history)                           │
│     [ ] %share auto-commit                                                  │
│     [ ] Diff view                                                           │
│     [ ] Optional remote push                                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## MVP Definition (Phase 1 Completion)

**MVP = Phase 1 complete. The app is usable for individual data scientists.**

```
MVP Capabilities:

✅ Edit and run Python code in #%% cells
✅ Local Python kernel managed by uv
✅ AI Chat (Chat mode only, user clicks to execute)
✅ View variables and outputs
✅ Create/save/load .py files
✅ Configure AI provider (OpenAI-compatible)
✅ Dark/light theme
✅ Vim mode (optional)

MVP Limitations:

❌ No remote kernel
❌ No multi-user
❌ No %%sql / %%bash
❌ No magic commands
❌ No checkpoints
❌ No skills (manual AI prompting only)
❌ No MCP
❌ No memory system
❌ No code publishing
❌ No Git integration
```

---

## Development Priorities

### Critical Path (MVP)

```
Tauri Skeleton → Monaco Editor → Local Kernel → uv → Output → AI Chat
      │              │              │          │        │        │
      └──────────────┴──────────────┴──────────┴────────┴────────┘
                              ~8–10 weeks
```

### Parallelizable Work

```
Week 1–4:
  Main: Tauri + Monaco + Kernel
  Parallel: UI components (output renderers, file tree)

Week 5–8:
  Main: Kernel ↔ AI integration
  Parallel: Variables panel, Settings UI

Week 9–12:
  Main: Polish, bug fixes, documentation
  Parallel: Testing, CI/CD setup
```

---

## Technical Debt & Deferred Items

### Intentionally Deferred

| Item | Reason | Target Phase |
|------|--------|--------------|
| Vector search for memory | Complexity, requires embedding model | Phase 2+ (community) |
| Memory strength decay | Complexity, needs validation | Phase 2+ (community) |
| Real-time collaboration | Out of scope for 5–20 person teams | Not planned |
| Kubernetes deployment | Overkill for target team size | Community extension |
| Mobile/tablet support | Desktop-first product | Not planned |
| Plugin system | Premature, wait for use cases | Phase 3+ |

### Known Limitations

- Local MCP stdio only works on desktop (not web)
- State migration between local/remote is lossy for large objects
- Dream Mode requires OpenAI-compatible embedding API (Phase 2 vector search)
- No offline AI (always requires API access)

---

## Release Milestones

```
v0.1.0  Phase 1 Alpha    Internal testing
v0.5.0  Phase 1 Beta     Limited user testing
v1.0.0  Phase 1 Release  MVP public release

v1.1.0  Phase 2 Alpha    Cell types, magic commands
v1.5.0  Phase 2 Beta     Skills, MCP, Memory, Dream Mode
v2.0.0  Phase 2 Release  Full desktop features

v2.5.0  Phase 3 Alpha    Server, multi-user
v3.0.0  Phase 3 Release  Remote kernel, publishing

v3.5.0  Phase 4 Alpha    Checkpoint system, magic commands, MCP tool calling
v4.0.0  Phase 4 Release  Feature Completion + Polish

v5.0.0  Phase 5 Release  Web Version (optional)
```

---

## Community Contribution Areas

These are intentionally left for community contribution:

1. **Additional language servers** (R, Julia support)
2. **OIDC/OAuth2 integration** for enterprise SSO
3. **Kubernetes deployment manifests**
4. **Additional MCP server adapters**
5. **Vector search integration** (Chroma, Qdrant, sqlite-vec)
6. **Memory strength decay model**
7. **Additional bundled skills**
8. **Internationalization (i18n)**
9. **Accessibility improvements (a11y)**
10. **CI/CD templates** (GitHub Actions, GitLab CI)
