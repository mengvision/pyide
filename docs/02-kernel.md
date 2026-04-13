# 02 · Python Kernel Architecture

## 1. Design Goals

| Goal | Decision |
|------|----------|
| No Jupyter dependency | Build custom PyKernel, no ipykernel required |
| Dual-mode operation | Local (uv venv on desktop) + Remote (Docker/cgroups on server) |
| Notebook-style UX | `#%%` cell delimiters in plain `.py` files |
| State persistence | 3-layer checkpoint system (hot → session → project) |
| Magic commands | Top 20% IPython compatibility only |
| AI integration | AI tools can inspect variables and execute code directly |

---

## 2. Kernel Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         PyKernel Architecture                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  IDE Frontend (React)                                                  │  │
│  │  Cell editor · Output panel · Variables · AI Chat                      │  │
│  └─────────────────────────────────┬──────────────────────────────────────┘  │
│                                    │                                         │
│                              WebSocket API                                   │
│              (ws://127.0.0.1 local OR wss://server remote)                  │
│                                    │                                         │
│  ┌─────────────────────────────────▼──────────────────────────────────────┐  │
│  │  PyKernel Process                                                      │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │  WebSocket Server                                                │  │  │
│  │  │  - JSON-RPC 2.0 message framing                                  │  │  │
│  │  │  - Message router (dispatch by method)                           │  │  │
│  │  └───────────────────────────┬──────────────────────────────────────┘  │  │
│  │                              │                                          │  │
│  │  ┌───────────────────────────▼──────────────────────────────────────┐  │  │
│  │  │  Message Router                                                  │  │  │
│  │  │  execute_request → Executor                                      │  │  │
│  │  │  inspect_request → StateManager                                  │  │  │
│  │  │  complete_request → Completer                                    │  │  │
│  │  │  checkpoint_* → CheckpointManager                                │  │  │
│  │  └───────────────────────────┬──────────────────────────────────────┘  │  │
│  │                              │                                          │  │
│  │  ┌───────────────────────────▼──────────────────────────────────────┐  │  │
│  │  │  Core Components                                                 │  │  │
│  │  │                                                                  │  │  │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │  │  │
│  │  │  │  Executor       │  │  StateManager   │  │  Completer      │   │  │  │
│  │  │  │  code execution │  │  variable store │  │  auto-complete  │   │  │  │
│  │  │  │  stdout/stderr  │  │  get/set/del    │  │  jedi-based     │   │  │  │
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘   │  │  │
│  │  │                                                                  │  │  │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │  │  │
│  │  │  │  MagicHandler   │  │  CellParser     │  │  Checkpoint     │   │  │  │
│  │  │  │  %/%% commands  │  │  #%% splitting  │  │  Manager        │   │  │  │
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘   │  │  │
│  │  │                                                                  │  │  │
│  │  │  ┌─────────────────┐                                             │  │  │
│  │  │  │  SQLEngine      │                                             │  │  │
│  │  │  │  %%sql cells    │                                             │  │  │
│  │  │  └─────────────────┘                                             │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Communication Protocol

### WebSocket Message Format (JSON-RPC 2.0 inspired)

```typescript
// Request (IDE → Kernel)
interface KernelRequest {
  id: string;           // UUID for request matching
  method: string;       // "execute" | "inspect" | "complete" | "checkpoint_save" | ...
  params: object;       // Method-specific parameters
}

// Response (Kernel → IDE)
interface KernelResponse {
  id: string;           // Matches request.id
  result?: object;      // On success
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// Stream output (Kernel → IDE, no request ID)
interface KernelStream {
  stream: "stdout" | "stderr" | "display_data" | "execute_result";
  data: {
    "text/plain"?: string;
    "text/html"?: string;
    "image/svg+xml"?: string;
    "application/json"?: object;
  };
}
```

### Key Methods

| Method | Params | Result | Description |
|--------|--------|--------|-------------|
| `execute` | `{ code, cell_id? }` | `{ status, outputs[] }` | Execute Python code |
| `execute_cell` | `{ file, cell_index }` | `{ status, outputs[] }` | Execute #%% cell by index |
| `inspect` | `{ variable_name }` | `{ name, type, value_preview, shape?, size? }` | Inspect single variable |
| `inspect_all` | `{}` | `{ variables: VariableInfo[] }` | List all variables |
| `complete` | `{ code, cursor_pos }` | `{ completions[] }` | Auto-complete |
| `interrupt` | `{}` | `{ status }` | Interrupt execution |
| `checkpoint_save` | `{ name? }` | `{ checkpoint_id, timestamp }` | Save state snapshot |
| `checkpoint_restore` | `{ checkpoint_id, vars? }` | `{ restored: string[] }` | Restore (full or selected) |
| `set_variable` | `{ name, value }` | `{ success }` | Set variable (for AI tools) |
| `get_variable_sample` | `{ name, rows? }` | `{ sample: object[] }` | Get DataFrame sample |

---

## 4. Cell Format

### File Format: `#%%` Delimiters (Spyder-style)

```python
# %%
import pandas as pd

df = pd.read_csv("data.csv")
df.head()

# %% [Visualization]
import plotly.express as px

fig = px.histogram(df, x="price")
fig.show()

# %% [SQL Demo]
# conn: postgresql://user:pass@host/db
# output: df_summary
# limit: 100
%%sql
SELECT category, COUNT(*) as cnt
FROM products
WHERE price > {{min_price}}
GROUP BY category
ORDER BY cnt DESC
```

### Cell Types

| Cell Type | Delimiter | Handler |
|-----------|-----------|---------|
| Python (default) | `# %%` or `# %% [title]` | Executor |
| SQL | `%%sql` | SQLEngine |
| Bash | `%%bash` | Shell executor (subprocess) |
| Markdown | `%%markdown` | Render as HTML |
| R | `%%r` | Optional: call R subprocess |

### SQL Cell Metadata

```python
# %% [SQL Analysis]
# conn: postgresql://user:pass@host/db    # Connection string or name
# output: df_result                        # Store result in variable
# limit: 100                               # Max rows returned
%%sql
SELECT * FROM users WHERE created_at > '{{start_date}}'
```

**Variable interpolation:**
- `{{variable}}` → Converted to parameterized query parameter
- Prevents SQL injection automatically

---

## 5. Magic Commands

### Top 20% IPython Compatibility

| Command | Description | Implementation |
|---------|-------------|----------------|
| `%pip install pkg` | Install package via uv pip | `uv pip install` |
| `%pyenv 3.11` | Switch Python version | `uv python switch` + kernel restart |
| `%env VAR value` | Set environment variable | `os.environ` |
| `%ai model_id` | Switch AI model | Update AI config |
| `%time stmt` | Time execution | `timeit` wrapper |
| `%checkpoint save name` | Save state | CheckpointManager |
| `%checkpoint restore name` | Restore state | CheckpointManager |
| `%checkpoint list` | List checkpoints | CheckpointManager |
| `%kernel local` | Switch to local kernel | KernelManager |
| `%kernel remote` | Switch to remote kernel | KernelManager |
| `%share team "title"` | Publish notebook | Publishing API |
| `%who` | List variables | StateManager |
| `%whos` | Detailed variable list | StateManager |
| `%reset` | Clear namespace | StateManager |
| `!command` | Shell escape | subprocess.run |
| `!!command` | Shell escape (capture output) | subprocess.run + capture |

### Cell Magics

| Command | Description |
|---------|-------------|
| `%%sql` | SQL cell with inline metadata |
| `%%bash` | Multi-line bash script |
| `%%markdown` | Render as markdown |
| `%%python` | Explicit Python (default) |
| `%%r` | R code (optional, requires R installation) |
| `%%time` | Time entire cell |

> **Implementation Note (Phase 4 Scope)**
> All magic commands listed above will be implemented in Phase 4. Each command follows the pipeline:
> parse args → execute → format output → return via JSON-RPC stream.
>
> **Priority order:**
> 1. Essential: `%who`, `%whos`, `%reset` — direct StateManager queries
> 2. Useful: `%env`, `%time` — OS/timing utilities
> 3. Advanced: `%checkpoint`, `%memory`, `%kernel`, `%share` — multi-subsystem coordination
>
> **Shell escapes:** `!command` and `!!command` execute via `subprocess.run()`; `!!` captures stdout back into the namespace.
>
> **Cell magics** (`%%sql`, `%%bash`, `%%time`, `%%markdown`) are detected by `CellParser` during the pre-execution parse pass and dispatched to `MagicHandler` before the Executor sees the cell body.

---

## 6. State Persistence

### 3-Layer Checkpoint System

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       Checkpoint Layer Architecture                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: Hot State (automatic)                                              │
│  ────────────────────────────                                               │
│  Every 60 seconds during active execution:                                  │
│    → Save variable names + types + sizes                                    │
│    → Store in memory only (fast recovery after interrupt)                   │
│    → Location: /tmp/pyide-{session}/hot-state.json                          │
│                                                                              │
│  Layer 2: Session Checkpoint (user/trigger)                                 │
│  ─────────────────────────────────────────                                  │
│  Triggered by:                                                              │
│    - User: %checkpoint save my_analysis                                     │
│    - Auto: kernel idle for 5 min                                            │
│    - Auto: before kernel restart/mode switch                                │
│  Content:                                                                   │
│    - Full namespace (dill serialized)                                       │
│    - Execution history (last 100 cells)                                     │
│  Location:                                                                  │
│    - Local: ~/.pyide/checkpoints/{project}/{timestamp}.pkl                 │
│    - Remote: /pyide-data/users/{user}/checkpoints/{project}/               │
│                                                                              │
│  Layer 3: Project Snapshot (explicit)                                       │
│  ────────────────────────────────                                           │
│  Triggered by user only:                                                    │
│    - %checkpoint snapshot "before major refactor"                           │
│  Content:                                                                   │
│    - Full checkpoint                                                        │
│    - Git commit hash (if in git repo)                                       │
│    - File list                                                              │
│  Location: .pyide/snapshots/{id}/                                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Serialization

```python
import dill  # Supports lambda, closures, custom classes

# Save
with open(checkpoint_path, "wb") as f:
    dill.dump({
        "namespace": globals().copy(),
        "history": execution_history,
        "timestamp": datetime.now().isoformat()
    }, f)

# Restore
with open(checkpoint_path, "rb") as f:
    data = dill.load(f)
    globals().update(data["namespace"])
```

### Restore Granularity

```python
# Full namespace restore
%checkpoint restore my_analysis

# Single variable restore
%checkpoint restore my_analysis --var df

# Multiple variables
%checkpoint restore my_analysis --var df --var model --var results
```

> **Implementation Note (Phase 4 Scope)**
> The full checkpoint system is scheduled for Phase 4. Key implementation details:
>
> - **Serialization:** uses `dill` (supports lambdas, closures, custom classes; see Serialization section above)
> - **Hot state:** auto-saves every 60 seconds to `/tmp/pyide-{session}/hot-state.json` during active execution
> - **Session checkpoints:** triggered by user `%checkpoint save` command, 5-minute kernel idle timeout, or automatically before a kernel mode switch
> - **Frontend:** a Checkpoint Manager UI panel will provide **Save**, **Restore**, and **List** buttons so users can manage checkpoints without typing magic commands
> - **Magic command routing:** all `%checkpoint` sub-commands are parsed and dispatched by `magic_handler.py` inside the PyKernel process

---

## 7. State Migration (Local ↔ Remote)

> **Implementation Note (Phase 3 Scope)**
> State migration between local and remote kernels is implemented as part of Phase 3 (Remote Kernel & Multi-User). When the user switches kernel mode:
> - A migration dialog is shown listing **transferred** variables (lightweight, serialized), **stubbed** variables (heavy objects >1 MB replaced with rebuild code), and **dropped** variables (non-serializable handles).
> - Heavy objects (>1 MB — e.g., large DataFrames, torch Tensors) are replaced with lightweight stubs that include auto-generated rebuild code (`pd.read_csv(...)`, `torch.load(...)`), allowing the user to one-click rebuild them in the new kernel.

### Problem

When switching kernel mode, the entire Python namespace cannot be transferred efficiently:
- Large DataFrames (GBs)
- GPU tensors
- Database connections
- File handles

### Solution: Data-Aware Migration Strategy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       State Migration Strategy                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Before mode switch:                                                         │
│                                                                              │
│  1. Analyze namespace:                                                       │
│     for name, obj in globals().items():                                     │
│         size = estimate_size(obj)                                           │
│         type = classify(obj)  # "lightweight" / "heavy" / "stubbable"       │
│                                                                              │
│  2. Classify variables:                                                      │
│     ┌─────────────────┬─────────────────┬────────────────────────────────┐  │
│     │ Type            │ Example         │ Migration Action              │  │
│     ├─────────────────┼─────────────────┼────────────────────────────────┤  │
│     │ Lightweight     │ int, str, dict  │ Serialize and transfer        │  │
│     │ (< 1 MB)        │ small list      │                                │  │
│     ├─────────────────┼─────────────────┼────────────────────────────────┤  │
│     │ Heavy           │ DataFrame (GB)  │ Create stub + rebuild code    │  │
│     │ (> 1 MB)        │ torch.Tensor    │                                │  │
│     ├─────────────────┼─────────────────┼────────────────────────────────┤  │
│     │ Non-serializable│ DB connection   │ Drop, log warning             │  │
│     │                 │ file handle     │                                │  │
│     └─────────────────┴─────────────────┴────────────────────────────────┘  │
│                                                                              │
│  3. Generate migration manifest:                                             │
│     {                                                                        │
│       "transferred": ["config", "params", "thresholds"],                    │
│       "stubbed": [                                                           │
│         {                                                                    │
│           "name": "df",                                                      │
│           "stub_type": "DataFrame",                                         │
│           "rebuild_code": "pd.read_csv('data.csv')",                        │
│           "source": "/data/large_file.csv"                                  │
│         }                                                                    │
│       ],                                                                     │
│       "dropped": ["db_conn"]                                                │
│     }                                                                        │
│                                                                              │
│  4. Transfer:                                                                │
│     - Lightweight variables → JSON/dill → WebSocket                         │
│     - Manifest → UI shows which vars need rebuild                           │
│                                                                              │
│  5. Post-migration UI:                                                       │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │  ⚠️  State Migration Complete                                       │  │
│     │                                                                     │  │
│     │  Transferred: 12 variables                                          │  │
│     │  Stubbed: 2 variables (click to rebuild)                            │  │
│     │    📊 df  ← [Rebuild] (pd.read_csv('data.csv'))                    │  │
│     │    🧠 model ← [Rebuild] (torch.load('model.pt'))                   │  │
│     │  Dropped: 1 variable                                                │  │
│     │    🔗 db_conn (cannot migrate connection)                           │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. uv Integration

### Environment Management

```python
# In Rust (Tauri backend)
// Create venv
Command::new("uv")
    .args(["venv", &env_path])
    .output()?;

// Install package
Command::new("uv")
    .args(["pip", "install", package])
    .current_dir(&project_path)
    .output()?;

// List environments
Command::new("uv")
    .args(["venv", "list"])
    .output()?;
```

### Python Version Management

```python
# Install Python version
uv python install 3.12

# Switch version (creates new venv)
%pyenv 3.11
```

### Configuration Storage

```
.pyide/
├── environments.json       # List of named environments
│   {
│     "ds-env": { "path": ".venv/ds-env", "python": "3.11" },
│     "ml-env": { "path": ".venv/ml-env", "python": "3.12", "gpu": true }
│   }
└── current-env            # Active environment symlink
```

---

## 9. Kernel Process Management

### Local Mode (Tauri/Rust)

```rust
// Start kernel process
let kernel = Command::new("python")
    .args(["-m", "pykernel", "--port", &port.to_string()])
    .env("VIRTUAL_ENV", &venv_path)
    .spawn()?;

// Health check loop
loop {
    if check_websocket_health(port) {
        break;
    }
    sleep(Duration::from_millis(100));
}

// Interrupt (SIGINT on Unix, Ctrl+C event on Windows)
kernel.send_signal(SIGINT)?;

// Shutdown
kernel.kill()?;
```

### Remote Mode (Server/FastAPI)

**With UV Support (Recommended)**:

The remote server now supports `uv`-managed Python environments via environment templates.

```python
# kernel_manager.py - Updated with uv support
from .uv_manager import uv_manager

class KernelManager:
    async def create_kernel(
        self,
        user_id: int,
        username: str,
        env_template_id: int = None,  # NEW: optional template
    ) -> KernelProcess:
        """Start kernel with optional uv-managed environment."""
        
        if env_template_id:
            # Create user's venv from template (lazy initialization)
            venv_path = await self._ensure_user_venv(username, env_template_id)
            python_exe = await uv_manager.get_python_path(venv_path)
        else:
            # Fallback to system Python
            python_exe = sys.executable
            venv_path = None
        
        # Start kernel with selected Python
        proc = subprocess.Popen(
            [python_exe, "-m", "pykernel", "--port", str(port)],
            env={**os.environ, "VIRTUAL_ENV": venv_path} if venv_path else None,
        )
```

**Environment Template Workflow**:

1. **Admin creates template** via API:
   ```bash
   POST /api/v1/environments/templates
   {
     "name": "data-science",
     "display_name": "Data Science Environment",
     "python_version": "3.12",
     "packages": ["pandas", "numpy", "matplotlib", "scikit-learn"]
   }
   ```

2. **User selects template** in IDE status bar dropdown

3. **Server creates user's venv** on first kernel start:
   ```bash
   /pyide-data/users/{username}/.venv/data-science/
   ```

4. **Kernel starts** with uv-managed Python and pre-installed packages

**Without UV (Legacy)**:

```python
# kernel_manager.py - Legacy mode (still supported)
import asyncio
import resource

class KernelManager:
    def __init__(self, user_id: str, quota: ResourceQuota):
        self.user_id = user_id
        self.quota = quota  # CPU, RAM, GPU limits
        
    async def start_kernel(self) -> str:
        """Start kernel process with cgroup limits"""
        # Create cgroup with limits
        cgroup_path = f"/sys/fs/cgroup/pyide/{self.user_id}"
        self._setup_cgroup(cgroup_path, self.quota)
        
        # Start process in cgroup
        proc = await asyncio.create_subprocess_exec(
            "python", "-m", "pykernel", "--port", str(port),
            preexec_fn=lambda: os.setpgrp(),
        )
        
        # Move to cgroup
        with open(f"{cgroup_path}/cgroup.procs", "w") as f:
            f.write(str(proc.pid))
        
        return f"wss://{server}/kernel/{self.user_id}"
```

---

## 10. Remote Kernel Resource Limits

### cgroups Configuration

```bash
# Set CPU limit (4 cores)
echo 400000 > /sys/fs/cgroup/pyide/{user_id}/cpu.max

# Set memory limit (16GB)
echo 16G > /sys/fs/cgroup/pyide/{user_id}/memory.max

# Set GPU access (via cgroup device allowlist)
# GPU allocation is managed at kernel start time
```

### GPU Allocation

```python
# Admin configures per-user GPU quota
user_config = {
    "alice": {"gpu": 1, "gpu_type": "A100"},
    "bob": {"gpu": 0},
    "charlie": {"gpu": 2, "gpu_type": "RTX4090"},
}

# When starting kernel
if user_config["gpu"] > 0:
    env["CUDA_VISIBLE_DEVICES"] = allocate_gpus(user_id, count)
```

---

## 11. Remote Mode UV Integration (NEW)

### Architecture

Remote mode now supports `uv` for managing Python environments, providing the same capabilities as Local mode but on the server side.

```
┌──────────────────────────────────────────────────────────────┐
│  PyIDE Server                                                 │
│                                                                │
│  1. Admin creates environment template                        │
│     POST /api/v1/environments/templates                       │
│     { "name": "ds-env", "python_version": "3.12",             │
│       "packages": ["pandas", "numpy"] }                      │
│                                                                │
│  2. User selects template in IDE                              │
│     Dropdown in status bar shows available templates          │
│                                                                │
│  3. User starts remote kernel                                 │
│     POST /api/v1/kernels/create                               │
│     { "env_template_id": 1 }                                  │
│                                                                │
│  4. Server creates user's venv (lazy initialization)         │
│     /pyide-data/users/{username}/.venv/ds-env/               │
│     - uv python install 3.12                                  │
│     - uv venv {path} --python 3.12                            │
│     - uv pip install pandas numpy                             │
│                                                                │
│  5. Kernel starts with uv-managed Python                      │
│     {venv}/bin/python -m pykernel --port 9001                 │
│     env["VIRTUAL_ENV"] = {venv_path}                          │
│                                                                │
│  6. User's IDE connects via WebSocket proxy                   │
│     ws://server/ws/kernel?token=<JWT>                         │
└──────────────────────────────────────────────────────────────┘
```

### Key Features

1. **Shared Environment Templates**: Admin pre-configures templates with specific Python versions and packages
2. **Per-User Isolation**: Each user gets their own venv copy, allowing custom package installations
3. **Lazy Initialization**: Venvs are created on first use, not upfront
4. **Auto Python Installation**: Server auto-installs Python versions via `uv python install`
5. **Backward Compatible**: System Python fallback if template fails or not selected

### API Endpoints

**List Templates (All Users)**:
```bash
GET /api/v1/environments/templates
Authorization: Bearer <token>

Response:
[
  {
    "id": 1,
    "name": "data-science",
    "display_name": "Data Science Environment",
    "python_version": "3.12",
    "packages": ["pandas", "numpy", "matplotlib"],
    "description": "Standard data science stack",
    "is_active": true
  }
]
```

**Create Template (Admin Only)**:
```bash
POST /api/v1/environments/templates
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "machine-learning",
  "display_name": "Machine Learning Environment",
  "python_version": "3.12",
  "packages": ["torch", "transformers", "scikit-learn"],
  "description": "Deep learning and NLP"
}
```

**Prewarm Template (Admin Only)**:
```bash
POST /api/v1/environments/templates/{id}/prewarm
Authorization: Bearer <admin-token>

# Pre-installs Python version and packages for faster first-time startup
```

### File Structure

```
/pyide-data/
├── users/
│   ├── alice/
│   │   └── workspace/
│   │       └── .venv/
│   │           ├── data-science/       # Alice's DS environment
│   │           │   ├── bin/python
│   │           │   └── lib/python3.12/
│   │           └── machine-learning/   # Alice's ML environment
│   └── bob/
│       └── workspace/
│           └── .venv/
│               └── data-science/       # Bob's DS environment (separate)
└── templates/                           # Optional: prewarmed base templates
    └── data-science/
```

### Server Setup

Install `uv` on the server:

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Verify installation
uv --version
```

### Usage Example

**Admin Setup**:
```python
# 1. Create environment template
import requests

response = requests.post(
    "http://server:8000/api/v1/environments/templates",
    headers={"Authorization": f"Bearer {admin_token}"},
    json={
        "name": "data-science",
        "display_name": "Data Science Environment",
        "python_version": "3.12",
        "packages": ["pandas", "numpy", "matplotlib", "seaborn", "scikit-learn"],
        "description": "Standard data science stack for analysis and visualization"
    }
)

# 2. Prewarm template (optional but recommended)
requests.post(
    f"http://server:8000/api/v1/environments/templates/{template_id}/prewarm",
    headers={"Authorization": f"Bearer {admin_token}"}
)
```

**User Selection**:
1. Open PyIDE desktop app
2. Switch to Remote mode in status bar
3. Click environment dropdown (⬡ icon)
4. Select "Data Science Environment (3.12)"
5. Start kernel
6. Kernel will use uv-managed Python with all packages pre-installed

### Error Handling

- **UV Not Installed**: Falls back to system Python with warning message
- **Template Not Found**: Falls back to system Python
- **Package Installation Fails**: Logs error, allows kernel to start (user can install manually)
- **Python Version Install Fails**: Falls back to system Python

### Benefits

| Feature | Without UV | With UV |
|---------|-----------|--------|
| Python Version | Server default only | Any version via `uv python install` |
| Package Management | Manual `pip install` | Pre-configured templates |
| Environment Isolation | Shared system Python | Per-user venvs |
| Reproducibility | Low | High (versioned templates) |
| Setup Time | Manual per-user | Automatic on first use |
