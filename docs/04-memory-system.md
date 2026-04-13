# 04 · Memory System

## 1. Overview

The Memory System is a neuroscience-inspired long-term memory architecture that learns from every session, discovers cross-session patterns, and reorganizes itself during idle periods ("Dream Mode").

**Key principle:** Memory is NOT just conversation history. It's structured, compressed, and actively reorganized knowledge that persists across sessions and projects.

---

## 2. Four-Layer Memory Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Memory Layer Architecture                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: Session Memory (automatic extraction)                              │
│  ──────────────────────────────────────────────                              │
│  Source: Current conversation                                                │
│  Storage: .pyide/session_memory.md                                          │
│  Content: Key facts, decisions, code snippets from THIS session             │
│  Lifecycle: Created during conversation, compressed or promoted on close    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Example Session Memory Entry:                                        │   │
│  │  ---                                                                  │   │
│  │  type: fact                                                           │   │
│  │  content: "User prefers Plotly for all visualizations"               │   │
│  │  context: "Data visualization discussion"                             │   │
│  │  timestamp: 2026-04-03T14:30:00Z                                      │   │
│  │  session_id: sess_abc123                                              │   │
│  │  is_pinned: false                                                     │   │
│  │  ---                                                                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Layer 2: Project Memory (project-level facts)                               │
│  ─────────────────────────────────────────────                               │
│  Source: Promoted from Session Memory, or manual entry                       │
│  Storage: .pyide/memory/project.md                                          │
│  Content: Project-specific conventions, data schemas, commonly used code    │
│  Lifecycle: Persists for project lifetime, shared across sessions           │
│                                                                              │
│  Layer 3: User Memory (cross-project preferences)                            │
│  ──────────────────────────────────────────────                              │
│  Source: Promoted from Project Memory, or manual entry                       │
│  Storage: ~/.pyide/memory/user.md (local) or server (remote)                │
│  Content: User preferences, coding style, frequently used libraries         │
│  Lifecycle: Persists across all projects for this user                      │
│                                                                              │
│  Layer 4: Team Memory (shared knowledge base)                                │
│  ─────────────────────────────────────────────                               │
│  Source: Admin-curated, or promoted from User Memory with approval          │
│  Storage: Server database (read-only for members)                           │
│  Content: Team conventions, shared data sources, best practices             │
│  Permission levels: public / dept / sensitive                               │
│  Lifecycle: Admin-managed, versioned                                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Memory Entry Schema

```typescript
interface MemoryEntry {
  id: string;
  type: "fact" | "preference" | "decision" | "code_snippet" | "pattern" | "warning";
  content: string;
  context?: string;          // Where/when this was learned
  source: "session" | "project" | "user" | "team";
  
  // Metadata
  timestamp: string;         // ISO 8601
  session_id?: string;
  project_id?: string;
  
  // Pin mechanism (prevents compression/forgetting)
  is_pinned: boolean;
  
  // Team Memory only
  permission?: "public" | "dept" | "sensitive";
  
  // Phase 2 fields (pre-reserved, inactive in MVP)
  strength?: number;         // 0.0 - 1.0, memory strength
  decay_rate?: number;       // How fast strength decays
  access_count?: number;     // Times this memory was accessed
  last_accessed?: string;    // Last access timestamp
  
  // Compression metadata
  compressed_from?: string[];  // IDs of original entries this was compressed from
}
```

---

## 3. Memory Extraction

### Automatic Extraction

During active conversation, a **background agent** monitors and extracts memories:

```typescript
// Trigger conditions (OR relationship)
const shouldExtract = (
  conversationTokens > 8000 ||    // Token threshold
  toolCallsCount > 10 ||          // Tool call threshold
  userRequestsSummary             // User explicitly asks
);

// Extraction prompt (sent to forked agent)
const extractionPrompt = `
Extract key memories from the following conversation:

CONVERSATION:
${conversationHistory}

Focus on:
1. User preferences (visualization style, library choices)
2. Important decisions (why X over Y)
3. Discovered patterns (e.g., "data has missing values in column X")
4. Reusable code snippets
5. Warnings or things to avoid

Output JSON array of memory entries.
`;
```

### Extraction Output

```json
[
  {
    "type": "preference",
    "content": "User prefers seaborn over matplotlib for static plots",
    "context": "Visualization library discussion"
  },
  {
    "type": "fact",
    "content": "Dataset 'sales.csv' has 50,000 rows, missing values in 'customer_id' column",
    "context": "Data loading and exploration"
  },
  {
    "type": "decision",
    "content": "Chose XGBoost over Random Forest due to better performance on imbalanced data",
    "context": "Model selection discussion"
  }
]
```

---

## 4. Memory Compression

### Trigger Conditions

```
Session Memory:
  - Size > 10 KB
  - Entry count > 100

Project Memory:
  - Size > 50 KB
  - Entry count > 200

User Memory:
  - Size > 100 KB
  - Entry count > 500
```

### Compression Strategy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Memory Compression Flow                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Cluster similar entries:                                                 │
│     - Keyword matching (MVP)                                                 │
│     - Semantic clustering (Phase 2 with vector search)                      │
│                                                                              │
│  2. Merge clusters into summary:                                            │
│     Original entries:                                                        │
│       - "User prefers Plotly"                                                │
│       - "User likes interactive charts"                                      │
│       - "User chose Plotly over Matplotlib"                                 │
│     Compressed:                                                              │
│       - "User strongly prefers Plotly for interactive visualizations"       │
│                                                                              │
│  3. Preserve pinned entries (never compress)                                │
│                                                                              │
│  4. Keep compressed_from references for traceability                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Dream Mode

### Concept

Dream Mode is inspired by neuroscience: during sleep, the brain consolidates memories, discovers associations, and reorganizes knowledge. PyIDE's Dream Mode does the same during user idle periods.

### Trigger Conditions

```
Full Dream Mode:
  - Distance from last dream ≥ 24 hours (rolling window, not calendar day)
  - AND
  - Sessions since last dream > 5
  - AND
  - User inactive ≥ 30 minutes
  - AND
  - No active kernel execution / AI conversation / MCP call
  
  Max wait: 48 hours after conditions met (prevents infinite deferral)
```

### Dream Phases

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Dream Mode Phases                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase N1: Weight Scan (~5% of dream time)                                  │
│  ───────────────────────────────────────────                                │
│  Compute importance weights for all memory entries:                          │
│    weight = access_count × recency_factor + is_pinned_bonus                 │
│                                                                              │
│  Output: Weighted memory list                                               │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Phase N3: Memory Transfer (~25% of dream time)                              │
│  ─────────────────────────────────────────                                   │
│  Promote memories across layers based on repetition:                        │
│                                                                              │
│    Session → Project:                                                        │
│      - Same fact appears in ≥ 2 sessions                                    │
│      - User explicitly saves                                                │
│                                                                              │
│    Project → User:                                                          │
│      - Same preference across ≥ 3 projects                                  │
│      - User explicitly promotes                                             │
│                                                                              │
│  Output: List of promoted memories                                          │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Phase REM-A: Association Discovery (~25% of dream time)                     │
│  ──────────────────────────────────────────────────                          │
│  Find cross-domain links between memories:                                  │
│                                                                              │
│    MVP (keyword-based):                                                      │
│      - Match entries with overlapping keywords                              │
│      - "uses XGBoost" ↔ "imbalanced data problem"                           │
│                                                                              │
│    Phase 2 (vector-based):                                                   │
│      - Embed all memories                                                    │
│      - Cluster by semantic similarity                                        │
│      - Discover non-obvious connections                                     │
│                                                                              │
│  Output: List of discovered associations                                    │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Phase REM-B: Abstraction (~25% of dream time)                              │
│  ───────────────────────────────────────────                                │
│  Extract general rules from clusters of specific memories:                  │
│                                                                              │
│    Specific memories:                                                        │
│      - "For sales.csv, handled missing values with forward fill"            │
│      - "For customers.csv, used mode imputation for categorical"            │
│      - "For products.csv, dropped rows with >50% missing"                   │
│                                                                              │
│    Abstracted rule:                                                          │
│      - "For time-series data, prefer forward fill; for categorical,        │
│         use mode imputation; drop rows only as last resort"                 │
│                                                                              │
│  Output: Abstracted patterns/rules                                          │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Phase REM-C: Contradiction Detection (~20% of dream time)                  │
│  ─────────────────────────────────────────────────────                       │
│  Find conflicting memories:                                                 │
│                                                                              │
│    Contradiction types:                                                      │
│      - Preference conflict: "prefers X" vs "prefers Y" for same task        │
│      - Fact conflict: "data has no nulls" vs "data has 10% nulls"           │
│      - Decision conflict: "chose approach A" vs "chose approach B"          │
│                                                                              │
│  Output: List of contradictions with context                                │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Phase Wake: Dream Report                                                   │
│  ───────────────────────────                                                │
│  Generate user-facing report:                                               │
│    - Insights discovered                                                    │
│    - Contradictions found                                                   │
│    - Memory restructuring summary                                           │
│    - Memory health stats                                                    │
│                                                                              │
│  Show on next IDE open                                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Dream Report Format

```markdown
# Dream Report - 2026-04-03

## Insights Discovered
- You frequently use XGBoost for imbalanced classification tasks
- Your data cleaning workflow consistently includes: null check → type conversion → outlier handling
- You prefer saving checkpoints before major model training

## Contradictions Found
⚠️ **Preference conflict detected:**
- Memory A: "User prefers Matplotlib for publication figures"
- Memory B: "User chose Plotly for final report visualization"
- Context: Different use cases (publication vs presentation)?

## Memory Restructuring
- 12 memories promoted from Session → Project
- 3 memories promoted from Project → User
- 47 redundant memories compressed into 8 summaries

## Memory Health
- Total entries: 234 (Session: 45, Project: 128, User: 61)
- Pinned: 12
- Compressed this session: 39 → 8
- Storage size: 24 KB

## Recommended Actions
- [ ] Resolve preference conflict about visualization libraries
- [ ] Review promoted memories for accuracy
```

### Dream Storage

```
.pyide/dreams/
├── 2026-04-03-dream.json      # Full dream state (phases, outputs)
├── 2026-04-03-report.md       # User-facing report
├── 2026-04-02-dream.json
├── 2026-04-02-report.md
└── idle-log.json              # Idle dream logs
```

---

## 6. Idle Dream Mode (发呆模式)

### Concept

Idle Dream is a lightweight, silent background process that runs during short idle periods. It only executes REM-C (contradiction detection) on new memories.

### Trigger Conditions

```
Idle Dream:
  - Sessions since last full dream > 20
  - AND
  - User inactive ≥ 5 minutes
  - AND
  - No active kernel / AI / MCP

Frequency limit:
  - First idle dream: after 5 min inactivity
  - Subsequent: interval ≥ 60 min, then ≥ 120 min
  - Then stop until next full dream
```

### Behavior

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Idle Dream Mode                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Executes ONLY:                                                              │
│    - REM-C (contradiction detection) on INCREMENTAL new memories            │
│                                                                              │
│  Does NOT:                                                                   │
│    - Show any user notification                                              │
│    - Run other phases (N1, N3, REM-A, REM-B)                                │
│    - Generate dream report                                                   │
│                                                                              │
│  Output:                                                                     │
│    - Tags memory entries with conflict_candidate: true                      │
│    - Logs to .pyide/dreams/idle-log.json                                    │
│                                                                              │
│  Purpose:                                                                    │
│    - Pre-process memories for next full dream                               │
│    - Reduce full dream workload                                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Idle Dream Log

```json
// .pyide/dreams/idle-log.json
[
  {
    "timestamp": "2026-04-03T10:30:00Z",
    "sessions_since_dream": 22,
    "memories_scanned": 15,
    "conflicts_found": 2,
    "conflict_entries": ["mem_abc123", "mem_def456"]
  }
]
```

---

## 7. Session Definition

```
Session count increments when EITHER:

  1. AI conversation round
     - User sends message → AI responds
     - Counts as 1 session unit

  2. Continuous active time block
     - Active for > 10 minutes
     - Gap of > 30 minutes = new block
     - Each block counts as 1 session unit

Actual session count = MAX(conversation_rounds, active_blocks)
```

---

## 8. Memory Retrieval

### Query-Based Retrieval

```typescript
interface MemoryQuery {
  query: string;           // Natural language query
  layers?: string[];       // ["session", "project", "user", "team"]
  types?: string[];        // ["fact", "preference", "decision", ...]
  limit?: number;          // Max entries to return
  include_pinned?: boolean;
}

// MVP: Keyword matching
function retrieveMemories(query: MemoryQuery): MemoryEntry[] {
  const keywords = extractKeywords(query.query);
  return allMemories
    .filter(m => matchesKeywords(m, keywords))
    .filter(m => query.layers?.includes(m.source) ?? true)
    .filter(m => query.types?.includes(m.type) ?? true)
    .slice(0, query.limit ?? 10);
}

// Phase 2: Vector similarity search
async function retrieveMemoriesVector(query: MemoryQuery): Promise<MemoryEntry[]> {
  const queryEmbedding = await embed(query.query);
  return vectorSearch(queryEmbedding, query);
}
```

### Context Injection

Before each AI message, relevant memories are retrieved and injected into context:

```typescript
const systemPrompt = `
You have access to the following memories from previous sessions:

${relevantMemories.map(m => `- [${m.source}] ${m.content}`).join('\n')}

Use these memories to provide contextually relevant responses.
If you notice conflicts between memories, mention them.
`;
```

---

## 9. Manual Memory Management

### Methods

```
1. Direct File Editing
   - Edit .pyide/memory/project.md directly
   - Changes detected on file save

2. Chat Natural Language
   User: "Remember that I always use UTC timezone for timestamps"
   AI: Creates memory entry with type=preference

3. UI Memory Manager Panel
   - Browse all memories by layer
   - Edit, delete, pin/unpin
   - Promote/demote between layers
```

### Memory Commands

```python
%memory list                    # List all memories
%memory search "visualization"  # Search by keyword
%memory pin mem_abc123          # Pin a memory
%memory unpin mem_abc123        # Unpin
%memory delete mem_abc123       # Delete
%memory promote mem_abc123      # Promote to next layer
%memory dream now               # Force trigger dream mode
```

---

## 10. MVP vs Phase 2 Scope

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Memory System Scope                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MVP (Phase 1) - INCLUDED:                                                   │
│  ──────────────────────────                                                  │
│  ✅ 4-layer structure (Session/Project/User/Team)                           │
│  ✅ Automatic extraction from conversations                                  │
│  ✅ Compression (keyword-based, size/count triggers)                        │
│  ✅ Full Dream Mode (all 4 phases + report)                                 │
│  ✅ Idle Dream Mode (silent REM-C)                                          │
│  ✅ Team Memory permission levels                                            │
│  ✅ Manual editing (file + chat + UI)                                       │
│  ✅ Pin mechanism                                                            │
│  ✅ Schema pre-reserves Phase 2 fields (inactive)                           │
│                                                                              │
│  Phase 2 - DEFERRED:                                                         │
│  ───────────────────                                                         │
│  🔲 Memory Strength decay model (Ebbinghaus-inspired)                       │
│  🔲 Short-term / Long-term memory zone separation                           │
│  🔲 Spaced repetition reinforcement                                          │
│  🔲 Automatic forgetting based on strength decay                            │
│  🔲 Vector similarity search for retrieval                                   │
│  🔲 Vector clustering for REM-A association discovery                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```
