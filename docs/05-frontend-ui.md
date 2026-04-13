# 05 · Frontend UI

## 1. Design Philosophy

- **Desktop-first:** Tauri application, not a web app wrapped in Electron
- **Code-OSS inspired:** Take Monaco Editor, build custom UI around it (NOT a VS Code fork)
- **RStudio/Spyder layout:** 4-panel structure optimized for data science workflows
- **Native feel:** Fast, responsive, keyboard-centric

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Shell | Tauri 2 (Rust) | Small bundle (~10MB), native OS APIs, system WebView |
| UI Framework | React 18 + TypeScript | Component model, strong ecosystem, type safety |
| Editor | Monaco Editor (standalone) | VS Code editing engine without the IDE overhead |
| State | Zustand | Simple, no boilerplate, works well with React |
| Tables | AG Grid Community | Virtual scroll, handles 100k+ rows |
| Charts | Plotly.js | Interactive, data science standard |
| Styling | CSS Modules + CSS Variables | Scoped styles, easy theming |
| Icons | VSCode Codicons | Consistent with Code-OSS feel |
| Build | Vite | Fast HMR, native ESM |

---

## 3. Window Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  File  Edit  View  Run  Kernel  AI  Help          [kernel: local 3.11]  ─ □ ✕│
├────────┬─────────────────────────────────────────────────────┬───────────────┤
│        │  tabs: analysis.py | model.py | config.yaml  [+]   │               │
│        ├─────────────────────────────────────────────────────┤               │
│        │                                                     │               │
│  FILE  │  # %% [Load Data]                                   │   VARIABLES   │
│        │  import pandas as pd                                │               │
│ 📁 src │  df = pd.read_csv('data.csv')                       │  df   DataFrame│
│   📄 a │  df.head()                                          │  n    int     │
│   📄 b │                                                     │  cfg  dict    │
│ 📁 data│  # %% [Visualization]                               │               │
│   📄 d │  import plotly.express as px                        │───────────────│
│        │  fig = px.histogram(df, x='price')                  │               │
│        │  fig.show()                                         │    PLOTS      │
│────────│                                                     │               │
│        │  [output area below each cell]                      │  📊 fig1      │
│ SKILLS │                                                     │  📊 fig2      │
│        │  ─────────────────────────────────────────────────  │               │
│  /eda  │  │ Output Panel (fixed bottom)           │         │───────────────│
│  /clean│  │ 📊 [Plotly Chart]              │       │         │               │
│  /viz  │  │ ┌─────────────────────────────┐│       │         │  AI CHAT      │
│  /model│  │ │                             ││       │         │               │
│        │  │ │   [Interactive Chart]       ││       │         │  User: Help me│
│────────│  │ │                             ││       │         │  visualize    │
│        │  │ └─────────────────────────────┘│       │         │  the sales    │
│  MCP   │  └────────────────────────────────┘       │         │  data         │
│        │                                             │         │               │
│ ⚡ db  │                                             │         │  AI: I'll     │
│ 📁 fs  │                                             │         │  create a...  │
│        │                                             │         │               │
├────────┴─────────────────────────────────────────────────────┴───────────────┤
│  ● local kernel  │  Python 3.11.9  │  uv: ds-env  │  Ln 42, Col 8  │  $0.02 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Panel Breakdown

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Title Bar                                                                    │
│  - Menu (File/Edit/View/Run/Kernel/AI/Help)                                  │
│  - Kernel status indicator (local/remote + Python version)                   │
│  - Window controls                                                           │
├───────────────────────────────────────────────────────────────────────────────┤
│  Left Sidebar (Activity Bar + Panel)      │  Editor Zone                     │
│  - Default: expanded, 220px width         │  - Monaco Editor                 │
│  - Activity Bar icons:                    │  - #%% cell parsing              │
│    📁 Files (default active)              │  - Cell type indicators (color)  │
│    ⚡ Skills                               │  - Cell hover toolbar            │
│    🔌 MCP                                  │                                  │
│    🧠 Memory                               │  Output Panel (fixed bottom)     │
│    📋 Tasks                                │  - Text output                   │
│                                            │  - DataFrame (AG Grid)          │
│                                            │  - Charts (Plotly)              │
│                                            │  - Errors with [AI Fix] button  │
├───────────────────────────────────────────────────────────────────────────────┤
│  Right Panel (tabbed)                                                         │
│  - Tab 1: Variables (default active)                                         │
│  - Tab 2: Plots                                                               │
│  - Tab 3: AI Chat                                                             │
│  - Tab 4: Environment (uv envs, packages)                                    │
├───────────────────────────────────────────────────────────────────────────────┤
│  Status Bar                                                                   │
│  - Kernel mode (local/remote)                                                │
│  - Python version                                                            │
│  - Active uv environment                                                     │
│  - Cursor position                                                           │
│  - Dream progress indicator (🌙 3/5 phases)                                 │
│  - Session cost                                                              │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Editor Features

### Cell Rendering

```python
# %% [Load Data]                    ← Cell title (optional, in comment)
# type: python                       ← Cell type indicator (color-coded)
import pandas as pd
df = pd.read_csv('data.csv')
df.head()
```

**Visual rendering:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ▌ # %% [Load Data]                                            [▶ Run] [⋮] │
│ │ import pandas as pd                                                       │
│ │ df = pd.read_csv('data.csv')                                              │
│ │ df.head()                                                                 │
│ └───────────────────────────────────────────────────────────────────────────┘
```

- Left border color indicates cell type
- Hover shows toolbar: Run, Run & Advance, Interrupt, Settings
- Clicking `# %%` line toggles cell selection

### Cell Type Colors

| Cell Type | Left Border Color | Icon |
|-----------|-------------------|------|
| Python | Blue `#3B82F6` | 🐍 |
| SQL | Orange `#F97316` | 🗄️ |
| Bash | Green `#22C55E` | 💻 |
| Markdown | Purple `#A855F7` | 📝 |
| R | Gray `#6B7280` | 📊 |

### Cell Hover Toolbar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ▌ # %% [Visualization]        [▶] [⏩] [⏹] [⚙] [⋮]                         │
│ │                                                                            │
│  ▶ = Run this cell                                                          │
│  ⏩ = Run and advance to next cell                                          │
│  ⏹ = Interrupt execution                                                    │
│  ⚙ = Cell settings (output format, timeout)                                 │
│  ⋮ = More actions (clear output, delete cell, split cell)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Output Panel

### Text Output

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Out [1]:                                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │    user_id  name    age  city                                            │ │
│ │ 0      001  Alice    28  NYC                                             │ │
│ │ 1      002  Bob      35  LA                                              │ │
│ │ 2      003  Carol    42  Chicago                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### DataFrame Output (AG Grid)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Out [2]: DataFrame (12,847 rows × 15 cols)        [↻] [⬇ CSV] [📊 Chart]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ▼ user_id │ ▼ name   │ ▼ age │ ▼ city   │ ▼ salary  │ ...              │ │
│ ├───────────┼──────────┼───────┼───────────┼───────────┼──────────────────┤ │
│ │ 001       │ Alice    │ 28    │ NYC       │ $85,000   │                  │ │
│ │ 002       │ Bob      │ 35    │ LA        │ $92,000   │                  │ │
│ │ ...       │ ...      │ ...   │ ...       │ ...       │                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ Showing 1-50 of 12,847 rows                                   [Load More]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Virtual scroll (handles 100k+ rows)
- Column sorting, filtering
- Export to CSV
- Quick chart button

### Chart Output (Plotly)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Out [3]: Plotly Figure                                            [⬇ PNG]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │              ┌──────────────────────────────────────────────┐           │ │
│ │              │                    ████                      │           │ │
│ │              │              ████  ████  ████                │           │ │
│ │              │        ████  ████  ████  ████  ████          │           │ │
│ │              │  ████  ████  ████  ████  ████  ████  ████    │           │ │
│ │              └──────────────────────────────────────────────┘           │ │
│ │                                                                         │ │
│ │              [Plotly interactive chart with zoom/pan/tooltip]           │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error Output

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Out [4]: Error                                          [🤖 AI Fix] [📋 Copy] │
├─────────────────────────────────────────────────────────────────────────────┤
│ ❌ NameError: name 'df_clean' is not defined                                │
│                                                                             │
│ Traceback (most recent call last):                                         │
│   File "<cell>", line 3, in <module>                                       │
│     result = df_clean.groupby('category').sum()                            │
│              ^^^^^^^^                                                       │
│ NameError: name 'df_clean' is not defined                                  │
│                                                                             │
│ 💡 Suggestion: Did you mean 'df'?                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Right Panel Tabs

### Variables Panel

```
┌───────────────────────────────┐
│ VARIABLES            [↻] [⚙] │
├───────────────────────────────┤
│ 🔍 Search variables...        │
├───────────────────────────────┤
│ Name          Type    Value   │
├───────────────────────────────┤
│ 📊 df         DataFrame       │
│   └─ shape    tuple   (12847,15)│
│   └─ columns  list    [...]   │
│                               │
│ 🔢 n          int     12847   │
│                               │
│ 📋 cfg        dict            │
│   └─ 'api_key' str    '***'   │
│   └─ 'timeout' int    30      │
│                               │
│ 🧠 model      XGBClassifier   │
│   └─ n_estimators int 100     │
│   └─ max_depth   int 6        │
└───────────────────────────────┘
```

### Plots Panel

```
┌───────────────────────────────┐
│ PLOTS                 [🗑️] [⚙]│
├───────────────────────────────┤
│ 📊 fig1 - Histogram          │
│    ┌─────────────────────┐   │
│    │ [miniature preview] │   │
│    └─────────────────────┘   │
│    Created: 14:30            │
│                               │
│ 📊 fig2 - Scatter Plot       │
│    ┌─────────────────────┐   │
│    │ [miniature preview] │   │
│    └─────────────────────┘   │
│    Created: 14:35            │
└───────────────────────────────┘
```

### AI Chat Panel

```
┌───────────────────────────────┐
│ AI CHAT              [⚙] [⊕] │
├───────────────────────────────┤
│ Mode: [Chat ▼]                │
│ Model: [GPT-4o ▼]             │
├───────────────────────────────┤
│                               │
│ 👤 User:                      │
│    Help me analyze the sales  │
│    data by region             │
│                               │
│ 🤖 AI:                        │
│    I'll group the data by     │
│    region and calculate       │
│    summary statistics.        │
│                               │
│    ```python                  │
│    region_sales = df.groupby  │
│      ('region').agg({...})    │
│    ```                        │
│    [▶ Execute] [Insert] [Copy]│
│                               │
├───────────────────────────────┤
│ 💬 Ask anything...      [Send]│
└───────────────────────────────┘
```

### Environment Panel

```
┌───────────────────────────────┐
│ ENVIRONMENT            [↻]    │
├───────────────────────────────┤
│ Active: ds-env (Python 3.11)  │
├───────────────────────────────┤
│ Environments:                 │
│   ● ds-env (active)           │
│   ○ ml-env (Python 3.12, GPU) │
│   ○ base (Python 3.10)        │
│                               │
│ [+ New Environment]           │
├───────────────────────────────┤
│ Installed Packages:           │
│   pandas 2.2.1                │
│   numpy 1.26.4                │
│   plotly 5.20.0               │
│   scikit-learn 1.4.1          │
│   ...                         │
│                               │
│ [+ Install Package]           │
└───────────────────────────────┘
```

---

## 7. Left Sidebar

### Files Panel

```
┌───────────────────────────────┐
│ FILES              [📁] [⚙]  │
├───────────────────────────────┤
│ 📁 pyide-project              │
│   📁 src                      │
│     📄 analysis.py            │
│     📄 model.py               │
│     📄 utils.py               │
│   📁 data                     │
│     📄 sales.csv              │
│     📄 products.csv           │
│   📁 notebooks                │
│     📄 exploration.py         │
│   📄 README.md                │
│   📄 pyproject.toml           │
│                               │
│ [+ New File] [+ New Folder]   │
└───────────────────────────────┘
```

### Skills Panel

```
┌───────────────────────────────┐
│ SKILLS              [🔍] [+]  │
├───────────────────────────────┤
│ Bundled:                      │
│   ⚡ /eda      [active]        │
│   ⚡ /clean                   │
│   ⚡ /viz                     │
│   ⚡ /model                   │
│   ⚡ /debug                   │
│                               │
│ Project Skills:               │
│   📄 project-etl              │
│   📄 data-validation          │
│                               │
│ Installed:                    │
│   🌐 financial-analysis       │
│     (from ClawHub)           │
│                               │
│ [+ Install from ClawHub]     │
└───────────────────────────────┘
```

### MCP Panel

```
┌───────────────────────────────┐
│ MCP SERVERS           [+]     │
├───────────────────────────────┤
│ Server: postgres-team         │
│   Status: ● Connected         │
│   Location: 🖥️ Server         │
│   Tools: query, schema        │
│                               │
│ Server: local-files           │
│   Status: ● Connected         │
│   Location: 💻 Local          │
│   Tools: read, write, list    │
│                               │
│ Server: slack-team            │
│   Status: ○ Disconnected      │
│   Location: 🖥️ Server         │
│   [Connect]                   │
└───────────────────────────────┘
```

### Memory Panel

```
┌───────────────────────────────┐
│ MEMORY               [🔍] [+] │
├───────────────────────────────┤
│ Session (12 entries)          │
│   📌 User prefers Plotly      │
│   📌 Dataset has null cols    │
│   ○ Model: XGBoost chosen     │
│                               │
│ Project (45 entries)          │
│   📌 Standard libraries: pd, np│
│   ○ Data path: ./data/        │
│                               │
│ User (23 entries)             │
│   📌 Timezone: UTC            │
│   📌 Theme: dark              │
│                               │
│ Team (8 entries, read-only)   │
│   🔒 DB connection standard   │
│   🔒 Code review checklist    │
└───────────────────────────────┘
```

---

## 8. Keyboard Shortcuts

### Execution

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Run current line/selection |
| `Ctrl+Shift+Enter` | Run cell |
| `Shift+Enter` | Run cell and advance |
| `F9` | Run current line/selection (Spyder compat) |
| `Ctrl+C` | Interrupt kernel (when execution active) |
| `Ctrl+Shift+C` | Clear all outputs |

### Navigation

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Focus Editor |
| `Ctrl+2` | Focus Variables |
| `Ctrl+3` | Focus Plots |
| `Ctrl+4` | Focus AI Chat |
| `Ctrl+0` | Focus Files |
| `Ctrl+B` | Toggle Left Sidebar |
| `Ctrl+J` | Toggle Right Panel |

### Editor

| Shortcut | Action |
|----------|--------|
| `Ctrl+/` | Toggle comment |
| `Ctrl+D` | Delete line |
| `Ctrl+Shift+K` | Delete line (VS Code compat) |
| `Alt+Up` | Move line up |
| `Alt+Down` | Move line down |
| `Ctrl+Shift+Enter` | Insert cell above |
| `Ctrl+Enter` (at end of file) | Insert cell below |

### AI Chat

| Shortcut | Action |
|----------|--------|
| `Ctrl+L` | Focus AI Chat input |
| `Ctrl+M` | Toggle AI Chat mode (Chat/Assist/Agent) |

### Command Palette

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Open Command Palette |
| `Ctrl+P` | Quick file open |

---

## 9. Vim Mode

Monaco Editor has built-in Vim keybinding support via `monaco-vim`.

```typescript
// Enable Vim mode
import { initVimMode } from 'monaco-vim';

const editor = monaco.editor.create(...);
initVimMode(editor, document.getElementById('vim-status-bar'));
```

**Configuration:**
- Default: OFF
- Toggle: Settings → Editor → Vim Mode
- Status bar shows Vim mode indicator (NORMAL / INSERT / VISUAL)

---

## 10. Theme System

### CSS Variables

```css
:root {
  /* Colors */
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d30;
  --text-primary: #cccccc;
  --text-secondary: #858585;
  --accent: #3b82f6;
  --accent-hover: #60a5fa;
  --border: #3c3c3c;
  
  /* Cell colors */
  --cell-python: #3b82f6;
  --cell-sql: #f97316;
  --cell-bash: #22c55e;
  --cell-markdown: #a855f7;
  
  /* Status colors */
  --status-success: #22c55e;
  --status-warning: #eab308;
  --status-error: #ef4444;
  
  /* Dimensions */
  --sidebar-width: 220px;
  --right-panel-width: 320px;
  --output-panel-height: 250px;
  --status-bar-height: 24px;
}
```

### Theme Switching

```typescript
// Stored in settings
interface ThemeSettings {
  mode: 'light' | 'dark' | 'system';
  customTheme?: Partial<typeof defaultTheme>;
}

// Apply theme
function applyTheme(theme: ThemeSettings) {
  if (theme.mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme.mode);
  }
}
```

---

## 11. Status Bar

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ● local kernel │ Python 3.11.9 │ uv: ds-env │ Ln 42, Col 8 │ 🌙 3/5 │ $0.02 │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Section | Content | Click Action |
|---------|---------|--------------|
| Kernel status | `● local kernel` / `● remote kernel` / `○ disconnected` | Kernel manager dialog |
| Python version | `Python 3.11.9` | Python version selector |
| uv environment | `uv: ds-env` | Environment selector |
| Cursor position | `Ln 42, Col 8` | Go to line dialog |
| Dream progress | `🌙 3/5` (only during Dream Mode) | Dream status popup |
| Session cost | `$0.02` | Cost breakdown |

---

## 12. Context Menus

### Editor Context Menu

```
┌─────────────────────────┐
│ ▶ Run Cell              │
│ ▶ Run Cell & Advance    │
│ ─────────────────────── │
│ ✂ Cut                   │
│ 📋 Copy                 │
│ 📄 Paste                │
│ ─────────────────────── │
│ 💬 Ask AI about this    │
│ 🤖 AI Fix Error         │
│ ─────────────────────── │
│ 📝 Toggle Comment       │
│ 📋 Format Document      │
└─────────────────────────┘
```

### Variable Context Menu

```
┌─────────────────────────┐
│ 👁 View Full Data       │
│ 📊 Visualize            │
│ 📋 Copy Name            │
│ 🗑 Delete Variable     │
│ ─────────────────────── │
│ 💬 Ask AI about df      │
└─────────────────────────┘
```
