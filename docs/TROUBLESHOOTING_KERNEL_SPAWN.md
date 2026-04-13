# Troubleshooting: Kernel Spawn Failure — "目录名称无效" (OS Error 267)

## 1. Symptom

- IDE status bar shows **"Kernel: disconnected"**
- Browser DevTools console shows:

```
[useLocalKernel] Failed to start kernel: Failed to spawn kernel process: 目录名称无效。 (os error 267)
```

---

## 2. Root Cause

In `apps/desktop/src-tauri/src/kernel.rs`, the `start_kernel` Tauri command used `.current_dir(&pykernel_path)` unconditionally when spawning the Python kernel process.

The `pykernel_path` value originated from the frontend (`apps/desktop/src/hooks/useKernel.ts`), which supplied the relative path `../../packages/pykernel`.

**The problem:** relative paths passed to `Command::current_dir()` are resolved relative to the **Tauri binary's working directory**, which during `tauri dev` is:

```
apps/desktop/src-tauri/target/debug/
```

From that location, `../../packages/pykernel` resolves to:

```
apps/desktop/src-tauri/packages/pykernel   ← does NOT exist
```

Windows therefore returns **OS error 267** ("invalid directory name" / 目录名称无效).

---

## 3. Fix Applied

**Location:** `apps/desktop/src-tauri/src/kernel.rs` — `start_kernel` function

The fix replaces the unconditional `.current_dir()` call with a **three-tier fallback resolution strategy**:

1. **Absolute path check** — if `pykernel_path` is already absolute and the directory exists, use it directly.
2. **Canonicalize from CWD** — attempt `std::fs::canonicalize()` to resolve the path from the process's current working directory.
3. **Executable-relative walk** — walk up the directory tree from `std::env::current_exe()`, searching for a `packages/pykernel` subdirectory (effectively locating the workspace root).
4. **Graceful fallback** — if no valid directory is found, skip `.current_dir()` entirely. Since `pykernel` is installed via `pip install -e .`, running `python -m pykernel` works from any directory.

### Before

```rust
let mut cmd = Command::new(&python);
cmd.arg("-m")
    .arg("pykernel")
    .arg("--port")
    .arg(port.to_string())
    .current_dir(&pykernel_path)  // ← Always set, fails with relative path
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
```

### After

```rust
let mut cmd = Command::new(&python);
cmd.arg("-m")
    .arg("pykernel")
    .arg("--port")
    .arg(port.to_string())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

// Try to resolve pykernel_path to a valid absolute directory
let resolved = std::path::Path::new(&pykernel_path);
if resolved.is_absolute() && resolved.is_dir() {
    cmd.current_dir(resolved);
} else if let Ok(abs) = std::fs::canonicalize(&pykernel_path) {
    if abs.is_dir() {
        cmd.current_dir(abs);
    }
} else {
    // Walk up from executable location to find workspace root
    if let Ok(exe) = std::env::current_exe() {
        let mut search = exe.parent().map(|p| p.to_path_buf());
        loop {
            match search {
                Some(ref dir) => {
                    let candidate = dir.join("packages").join("pykernel");
                    if candidate.is_dir() {
                        cmd.current_dir(candidate);
                        break;
                    }
                    search = dir.parent().map(|p| p.to_path_buf());
                }
                None => break,
            }
        }
    }
    // If no valid dir found, skip current_dir — pykernel is pip-installed
}
```

---

## 4. How to Start Local Kernel + IDE for Testing

### Terminal 1 — Start PyKernel

```powershell
cd c:\Users\lenovo\Desktop\python_ide1
python -m pykernel --port 8765 --log-level INFO
# Expected output: "PyKernel started on ws://127.0.0.1:8765"
```

### Terminal 2 — Start Desktop IDE

```powershell
cd c:\Users\lenovo\Desktop\python_ide1\apps\desktop
npm run dev
# Vite starts on http://localhost:1421, then Tauri compiles and opens the window
```

### Connectivity Ports

| Component       | Port                          | Protocol |
|-----------------|-------------------------------|----------|
| PyKernel        | 8765 (auto-fallback 8766–9999) | ws://    |
| Vite Dev Server | 1421                          | http://  |

---

## 5. Lesson Learned

- In Tauri desktop apps, the binary's working directory during `tauri dev` is **not** the project root — it is the `target/debug/` folder inside `src-tauri/`. Relative paths passed from the frontend to Rust Tauri commands will resolve from that location, not from the source tree.
- Always validate and canonicalize path arguments on the Rust side before passing them to `Command::current_dir()`.
- When the target package is pip-installed in editable mode (`pip install -e .`), it can be invoked via `python -m <package>` from any working directory, making `.current_dir()` optional rather than required.
