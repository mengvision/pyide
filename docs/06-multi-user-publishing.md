# 06 · Multi-User & Code Publishing

## 1. Deployment Model

**Open source, MIT license, private deployment by enterprise teams.**

| Aspect | Decision |
|--------|----------|
| Target team size | 5–20 people |
| Deployment | Docker Compose on single server |
| Multi-tenancy | Not required (single organization per deployment) |
| Real-time collaboration | NOT supported (no multi-user editing) |

---

## 2. User Roles & Permissions

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Role Permission Matrix                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Permission                    Admin    Member    Viewer                      │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Use remote kernel              ✅        ✅        ❌                        │
│  Manage own workspace           ✅        ✅        ❌                        │
│  Publish code                   ✅        ✅        ❌                        │
│  Read Team Memory               ✅        ✅        ✅ (public only)          │
│  Install personal skills        ✅        ✅        ❌                        │
│  Configure personal MCP         ✅        ✅        ❌                        │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Manage users                   ✅        ❌        ❌                        │
│  Configure resource quotas      ✅        ❌        ❌                        │
│  Manage Team Memory             ✅        ❌        ❌                        │
│  Configure shared MCP           ✅        ❌        ❌                        │
│  View audit logs                ✅        ❌        ❌                        │
│  Manage team skills             ✅        ❌        ❌                        │
│  ─────────────────────────────────────────────────────────────────────────── │
│  GPU access                     Configurable per user                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication

### MVP: Username + Password + JWT

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Auth Flow                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Login                                                                    │
│     POST /api/auth/login                                                    │
│     Body: { "username": "alice", "password": "***" }                        │
│     Response: { "access_token": "...", "refresh_token": "..." }            │
│                                                                              │
│  2. Access Token                                                             │
│     - JWT, expires in 15 minutes                                            │
│     - Included in Authorization: Bearer <token>                             │
│     - Contains: user_id, role, exp                                          │
│                                                                              │
│  3. Refresh Token                                                            │
│     - JWT, expires in 7 days                                                │
│     - Stored in HTTP-only cookie                                            │
│     - Used to get new access token                                          │
│                                                                              │
│  4. Logout                                                                   │
│     POST /api/auth/logout                                                   │
│     - Blacklists refresh token                                              │
│     - Clears cookie                                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Password Security

```python
import bcrypt

# Hash password
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))

# Verify
bcrypt.checkpw(password.encode(), stored_hash)
```

### Session Management

```typescript
interface UserSession {
  id: string;
  user_id: string;
  device_info: string;     // User-Agent
  ip_address: string;
  created_at: string;
  last_active: string;
}

// User can view and revoke sessions
GET  /api/auth/sessions
DELETE /api/auth/sessions/{session_id}
```

### Optional Extensions (Community Contribution)

- OIDC / OAuth2 (for SSO integration)
- LDAP (for Active Directory)
- TOTP 2FA

---

## 4. Workspace Isolation

### Directory Structure

```
/pyide-data/
├── users/
│   ├── alice/
│   │   ├── workspace/              # Personal project files
│   │   │   ├── project-a/
│   │   │   │   ├── analysis.py
│   │   │   │   ├── .pyide/
│   │   │   │   │   ├── checkpoints/
│   │   │   │   │   ├── memory/
│   │   │   │   │   └── session_memory.md
│   │   │   └── project-b/
│   │   ├── envs/                   # Personal uv environments
│   │   │   ├── ds-env/
│   │   │   └── ml-env/
│   │   ├── memory/                 # User Memory
│   │   │   └── user.md
│   │   ├── settings.json           # Personal settings
│   │   └── credentials.enc         # Encrypted credentials
│   ├── bob/
│   │   └── ...
│   └── ...
│
├── team/
│   ├── memory/                     # Team Memory
│   │   ├── public/                 # All members can read
│   │   ├── dept/                   # Department-level access
│   │   └── sensitive/              # Admin-only
│   ├── skills/                     # Team-shared skills
│   │   └── team-eda.md
│   └── mcp/                        # Team-shared MCP config
│       └── mcp.json
│
├── shared/
│   └── published/                  # Published code
│       ├── public/                 # Publicly accessible
│       │   ├── alice/
│       │   │   └── q1-analysis/
│       │   │       ├── analysis.py
│       │   │       ├── output/
│       │   │       └── meta.json
│       │   └── bob/
│       └── team/                   # Team-only
│           ├── alice/
│           └── bob/
│
└── system/
    ├── audit.log
    └── config.json
```

### File System Permissions

```bash
# Each user's directory is 700 (owner only)
chmod 700 /pyide-data/users/alice

# Team directories are 750 (owner + group)
chmod 750 /pyide-data/team/memory/public
chgrp team-public /pyide-data/team/memory/public

# Published directories are 755 (world readable for public)
chmod 755 /pyide-data/shared/published/public
```

### Process Isolation

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Process Isolation Model                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Each user's kernel runs as an independent process (not containerized).     │
│                                                                              │
│  Server Process (FastAPI)                                                    │
│  └── Kernel Manager                                                         │
│       ├── pykernel (user=alice, pid=12345, cgroup=pyide/alice)              │
│       ├── pykernel (user=bob, pid=12346, cgroup=pyide/bob)                  │
│       └── pykernel (user=carol, pid=12347, cgroup=pyide/carol)              │
│                                                                              │
│  Resource limits via cgroups:                                                │
│    /sys/fs/cgroup/pyide/alice/                                              │
│      ├── cpu.max         (CPU limit)                                        │
│      ├── memory.max      (Memory limit)                                     │
│      └── cgroup.procs    (PIDs in this cgroup)                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Resource Management

### cgroups Configuration

```python
# kernel_manager.py
import os
from dataclasses import dataclass

@dataclass
class ResourceQuota:
    cpu_cores: int       # e.g., 4
    memory_gb: int       # e.g., 16
    gpu_count: int       # e.g., 1
    
def setup_cgroup(user_id: str, quota: ResourceQuota):
    cgroup_path = f"/sys/fs/cgroup/pyide/{user_id}"
    os.makedirs(cgroup_path, exist_ok=True)
    
    # CPU limit (percentage of one core × 10000)
    # 4 cores = 400000
    with open(f"{cgroup_path}/cpu.max", "w") as f:
        f.write(f"{quota.cpu_cores * 100000} 100000")
    
    # Memory limit
    with open(f"{cgroup_path}/memory.max", "w") as f:
        f.write(f"{quota.memory_gb}G")
```

### GPU Allocation

```python
# GPU pool management
class GPUManager:
    def __init__(self, available_gpus: list[str]):
        self.available = set(available_gpus)  # ["0", "1", "2", "3"]
        self.allocated = {}  # user_id -> set of gpu_ids
    
    def allocate(self, user_id: str, count: int) -> list[str]:
        """Allocate GPUs for a user."""
        if len(self.available) < count:
            raise InsufficientGPUError()
        
        gpus = list(self.available)[:count]
        self.allocated[user_id] = set(gpus)
        self.available -= set(gpus)
        return gpus
    
    def get_visible_devices(self, user_id: str) -> str:
        """Get CUDA_VISIBLE_DEVICES value for user."""
        if user_id not in self.allocated:
            return ""  # No GPU access
        return ",".join(self.allocated[user_id])
```

### Resource Quota Configuration

```json
// Admin panel: user resource config
{
  "users": {
    "alice": {
      "cpu_cores": 8,
      "memory_gb": 32,
      "gpu_count": 1,
      "gpu_type": "A100"
    },
    "bob": {
      "cpu_cores": 4,
      "memory_gb": 16,
      "gpu_count": 0
    },
    "carol": {
      "cpu_cores": 16,
      "memory_gb": 64,
      "gpu_count": 2,
      "gpu_type": "RTX4090"
    }
  }
}
```

---

## 6. Code Publishing

### Visibility Levels

| Level | Who Can View | Use Case |
|-------|--------------|----------|
| `private` | Only author | Personal archive, work-in-progress |
| `team` | All team members | Share analysis results, reusable code |
| `public` | Anyone with link (can be disabled by admin) | External sharing, portfolio |

### Publishing Content

```typescript
interface PublishedScript {
  id: string;
  title: string;
  description: string;
  author_id: string;
  author_name: string;
  
  // Visibility
  visibility: "private" | "team" | "public";
  
  // Content
  source_file: string;           # Original .py file path
  source_code: string;           # Full source with #%% cells
  
  // Output snapshots
  outputs: CellOutput[];         # Each cell's output
  
  // Environment
  python_version: string;
  requirements: string[];        # List of packages
  
  // Metadata
  tags: string[];
  created_at: string;
  updated_at: string;
  
  // Versioning (Phase 2)
  version: number;
  parent_version?: number;
}

interface CellOutput {
  cell_index: number;
  cell_title?: string;
  output_type: "text" | "dataframe" | "chart" | "error";
  content: any;  # Text, DataFrame JSON, Chart HTML, Error message
}
```

### Publishing Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Publishing Flow                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User triggers publish                                                    │
│     - %share team "Q1 Sales Analysis"                                       │
│     - File menu → Publish                                                    │
│     - Right-click → Publish cell                                            │
│                                                                              │
│  2. IDE collects content                                                     │
│     - Source code from editor                                               │
│     - Output snapshots from kernel                                          │
│     - Environment info (Python version, packages)                           │
│                                                                              │
│  3. User fills metadata                                                      │
│     - Title, description, tags                                              │
│     - Visibility selection                                                  │
│                                                                              │
│  4. Server stores                                                            │
│     - Save to /pyide-data/shared/published/{visibility}/{user}/{id}/        │
│     - Update search index                                                   │
│                                                                              │
│  5. Generate share link                                                      │
│     - Team:  https://pyide.company.com/published/team/alice/q1-analysis     │
│     - Public: https://pyide.company.com/published/public/alice/q1-analysis  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Published Page Rendering

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Q1 Sales Analysis                                                           │
│  by Alice · 2026-04-03                                                       │
│  tags: [sales] [Q1] [visualization]                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  # %% [Load Data]                                                            │
│  ```python                                                                   │
│  import pandas as pd                                                         │
│  df = pd.read_csv('sales.csv')                                               │
│  print(f"Loaded {len(df)} rows")                                            │
│  ```                                                                         │
│  ✅ Output: Loaded 12,847 rows                                               │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  # %% [Regional Analysis]                                                    │
│  ```python                                                                   │
│  import plotly.express as px                                                 │
│  fig = px.bar(df.groupby('region')['revenue'].sum().reset_index(),          │
│               x='region', y='revenue')                                       │
│  fig.show()                                                                  │
│  ```                                                                         │
│  📊 [Interactive Plotly Chart - click to view]                               │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  [📋 Copy Code] [⬇ Download .py] [🚀 Open in PyIDE]                          │
│                                                                              │
│  Environment: Python 3.11.9 · pandas 2.2.1 · plotly 5.20.0                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Deep Link: "Open in PyIDE"

```
URL scheme: pyide://open?published_id=abc123

Desktop app registers pyide:// protocol handler:
1. Parse URL
2. Fetch published content from server
3. Create new file or append to current file
4. Optionally recreate environment (install packages)
```

---

## 7. Version History

### MVP: Self-Contained Version Snapshots

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    MVP Version History (Simple Snapshots)                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Each publish creates a new version snapshot:                               │
│                                                                              │
│  /pyide-data/shared/published/team/alice/q1-analysis/                       │
│  ├── v1/                                                                     │
│  │   ├── analysis.py                                                         │
│  │   ├── outputs.json                                                        │
│  │   └── meta.json                                                           │
│  ├── v2/                                                                     │
│  │   ├── analysis.py                                                         │
│  │   ├── outputs.json                                                        │
│  │   └── meta.json                                                           │
│  ├── v3/                        ← Current version                           │
│  │   └── ...                                                                  │
│  └── current → v3/                ← Symlink to latest                       │
│                                                                              │
│  Published page shows version selector:                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Version: [v3 (latest) ▼]                                                │ │
│  │          v3  2026-04-03  "Added regional breakdown"                     │ │
│  │          v2  2026-04-01  "Fixed column names"                          │ │
│  │          v1  2026-03-28  "Initial version"                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  No diff view, no merge. Simple snapshot history only.                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Phase 2: Local Git Integration

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Phase 2: Git Integration                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Each project is a Git repository:                                           │
│                                                                              │
│  project-a/                                                                   │
│  ├── .git/                                                                   │
│  ├── analysis.py                                                             │
│  └── .pyide/                                                                 │
│                                                                              │
│  %share triggers auto-commit:                                                │
│    git add analysis.py                                                       │
│    git commit -m "publish: Q1 Analysis [team]"                              │
│                                                                              │
│  Git panel in sidebar:                                                       │
│    - Changes (modified files)                                                │
│    - Commit button                                                           │
│    - History (commit log)                                                   │
│    - Remote: optional push to GitHub/GitLab                                 │
│                                                                              │
│  Version history = Git commit history                                        │
│  Diff view between versions                                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### GitHub Integration (Lightweight)

```
No OAuth. Simple features only:

1. Import from GitHub URL
   User pastes: https://github.com/user/repo/blob/main/analysis.py
   IDE downloads file to current project
   
2. Display remote link (if configured)
   Published page shows: "📂 Source on GitHub: github.com/user/repo"
   User manually maintains their own remote
   
Cost: < 3 days development
```

---

## 8. Admin Panel

### Web Interface (Separate from Desktop App)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PyIDE Admin                                              admin · logout     │
├──────────────────────────────────────────────────────────────────────────────┤
│  👥 Users          🖥 Kernels        📚 Team Memory      📊 Usage            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Users (7/20)                                        [+ Invite User]         │
│  ────────────────────────────────────────────────────────────────────────   │
│  Username   Role     Status       Resources          Last Active            │
│  ────────────────────────────────────────────────────────────────────────   │
│  alice      Member   🟢 Active    4 CPU / 16G / 1G  2 minutes ago           │
│  bob        Member   🟡 Idle      4 CPU / 16G / 0G  1 hour ago               │
│  carol      Admin    ⚫ Offline   Unlimited          3 hours ago             │
│  dave       Member   🟢 Active    8 CPU / 32G / 2G  now                      │
│  ...                                                                         │
│                                                                              │
│  [Edit] [Disable] [Reset Password]                                           │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  System Resources                                                            │
│  ────────────────────────────────────────────────────────────────────────   │
│  CPU:  ████████░░░░░░░░  52%  (42/80 cores)                                 │
│  RAM:  ██████░░░░░░░░░░  38%  (49/128 GB)                                   │
│  GPU:  ████████████░░░░  75%  (3/4 × A100)                                  │
│  Disk: ███░░░░░░░░░░░░░  18%  (1.8/10 TB)                                   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  Team Memory                                                   [Manage]     │
│  ────────────────────────────────────────────────────────────────────────   │
│  Public: 45 entries · Dept: 12 entries · Sensitive: 3 entries               │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  Settings                                                                    │
│  ────────────────────────────────────────────────────────────────────────   │
│  [✓] Public publishing enabled                                              │
│  [✓] Allow user-installed skills                                            │
│  [✓] Allow user-configured MCP                                              │
│  [ ] Require password change on first login                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Admin API Endpoints

```
# User Management
GET    /api/admin/users                    # List users
POST   /api/admin/users                    # Create user
PATCH  /api/admin/users/{id}               # Update user
DELETE /api/admin/users/{id}               # Disable user
POST   /api/admin/users/{id}/reset-password

# Resource Management
GET    /api/admin/resources                # System resource usage
PATCH  /api/admin/users/{id}/quota         # Update user quota

# Team Memory
GET    /api/admin/memory                   # List team memory
POST   /api/admin/memory                   # Add entry
DELETE /api/admin/memory/{id}              # Delete entry

# System
GET    /api/admin/audit-log                # View audit logs
GET    /api/admin/settings                 # Get settings
PATCH  /api/admin/settings                 # Update settings
```

---

## 9. Audit Logging

```
All significant actions are logged:

/pyide-data/system/audit.log

Format: JSONL (one JSON object per line)

{
  "timestamp": "2026-04-03T14:30:00Z",
  "user_id": "alice",
  "action": "kernel_start",
  "resource": "remote_kernel",
  "details": {
    "mode": "remote",
    "environment": "ds-env",
    "python_version": "3.11.9"
  },
  "ip_address": "192.168.1.100"
}

{
  "timestamp": "2026-04-03T14:35:00Z",
  "user_id": "alice",
  "action": "publish",
  "resource": "analysis.py",
  "details": {
    "visibility": "team",
    "title": "Q1 Sales Analysis"
  }
}

{
  "timestamp": "2026-04-03T14:40:00Z",
  "user_id": "admin",
  "action": "user_create",
  "resource": "dave",
  "details": {
    "role": "member",
    "quota": {"cpu_cores": 4, "memory_gb": 16, "gpu_count": 0}
  }
}
```

---

## 10. Design Updates

### 10.1 Authentication Flow Update

Authentication in `App.tsx` **only gates remote mode**. The login screen is not shown for local (standalone) use, preserving Phase 1 single-user desktop capability.

| `kernelMode` | Behavior |
|---|---|
| `'local'` | Skip login entirely — goes straight to `AppLayout` |
| `'remote'` | Existing login flow applies (JWT required) |

```typescript
// App.tsx — conditional auth gate
const kernelMode = useUiStore((s) => s.kernelMode);

if (kernelMode === 'remote' && !isAuthenticated) {
  return <Login onLoginSuccess={handleLoginSuccess} />;
}

// local mode (or already authenticated) falls through to:
return <AppLayout />;
```

This means the desktop app works fully offline without any server, and remote mode is an opt-in that requires authentication.

---

### 10.2 Token Storage Update

JWT tokens are stored in **Tauri secure storage** (via Rust `invoke` command), not in React state or `localStorage`.

| Concern | Implementation |
|---|---|
| Access token storage | Tauri secure storage (`invoke('store_token', ...)`) |
| Auto-refresh | Refresh triggered automatically before 15-min expiration |
| API request headers | All calls include `Authorization: Bearer {token}` |
| Logout | Clears secure storage + revokes server session via `POST /api/auth/logout` |
| Refresh tokens | HTTP-only cookies managed server-side (not accessible to JS) |

Token refresh lifecycle:
```
Access token expires in 15 min
  → Client detects expiry (or pre-emptively at ~13 min)
  → POST /api/auth/refresh  (cookie sent automatically)
  → Server returns new access_token
  → Stored in Tauri secure storage
  → Retry original request with new token
```

---

### 10.3 Server URL Configuration

The remote server URL is **configurable in the Settings UI** — not hardcoded in the application bundle.

| Setting | Value |
|---|---|
| Settings field label | **Remote Server URL** |
| Default (development) | `http://localhost:8000` |
| Validation | Must be a valid URL; trailing slash stripped automatically |
| Storage | `settingsStore` → persisted to `~/.pyide/settings.json` |

Users can point the desktop app at any self-hosted deployment by updating this field. Changes take effect on the next kernel connection attempt.

---

### 10.4 Dual-Mode Kernel Architecture

The [`useKernel`](../apps/desktop/src/hooks/useKernel.ts) hook branches on `kernelMode` from `uiStore` to provide a unified interface over two distinct transport layers.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       Dual-Mode Kernel Architecture                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  useKernel (unified interface)                                               │
│    ├── kernelMode === 'local'                                                │
│    │     WebSocket: ws://127.0.0.1:{port}                                   │
│    │     Managed by Tauri (spawns local PyKernel process)                   │
│    │                                                                         │
│    └── kernelMode === 'remote'                                               │
│          WebSocket: wss://{serverUrl}/kernel/{userId}                       │
│          Auth header: Bearer {jwt_token}                                    │
│          Managed by FastAPI KernelManager on server                         │
│                                                                              │
│  Both modes expose identical interface:                                      │
│    execute(code)  ·  inspect(obj)  ·  inspect_all()                         │
│    interrupt()    ·  complete(prefix)                                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Mode switching triggers a **state migration**: variables and execution history cannot be transferred between kernels. The user is prompted to confirm before switching modes. See [doc/02-kernel.md Section 7](./02-kernel.md) for migration details.

---

## 11. Docker Compose Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  pyide-server:
    build: ./apps/server
    ports:
      - "8000:8000"
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=postgresql://pyide:${POSTGRES_PASSWORD}@postgres:5432/pyide
      - REDIS_URL=redis://redis:6379
    volumes:
      - pyide-data:/pyide-data
    depends_on:
      - postgres
      - redis

  pyide-admin:
    build: ./apps/admin
    ports:
      - "3000:3000"
    environment:
      - API_URL=http://pyide-server:8000
    depends_on:
      - pyide-server

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_USER=pyide
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=pyide
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

volumes:
  pyide-data:
  postgres-data:
  redis-data:
```

### Environment Variables

```bash
# .env
SECRET_KEY=your-super-secret-key-here
POSTGRES_PASSWORD=secure-password-here
SERVER_URL=https://pyide.yourcompany.com

# Optional: AI provider defaults
DEFAULT_AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
DEFAULT_MODEL=gpt-4o
```

### First-Run Setup

```bash
# 1. Clone and configure
git clone https://github.com/your-org/pyide.git
cd pyide
cp .env.example .env
# Edit .env

# 2. Start services
docker compose up -d

# 3. Initialize database
docker compose exec pyide-server python -m pyide_server.init_db

# 4. Create admin user
docker compose exec pyide-server python -m pyide_server.create_admin \
  --username admin --email admin@company.com --password ...

# 5. Access admin panel
open http://localhost:3000
```

---

## 12. Security Checklist

- [ ] All passwords hashed with bcrypt (rounds ≥ 12)
- [ ] JWT access tokens expire in 15 minutes
- [ ] Refresh tokens stored in HTTP-only, Secure, SameSite cookies
- [ ] All API endpoints require authentication (except login, health)
- [ ] Admin endpoints require admin role
- [ ] File access validated against user workspace
- [ ] Remote kernel WebSocket requires valid JWT
- [ ] Sensitive data never logged
- [ ] HTTPS enforced in production (via nginx reverse proxy)
- [ ] cgroups prevent resource exhaustion by single user
- [ ] Audit log enabled for all sensitive operations
