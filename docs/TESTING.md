# PyIDE Testing Documentation

**Version:** 0.1.0  
**Last Updated:** April 5, 2026  
**Status:** Phase 1 MVP Complete ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Quick Start - Run All Tests](#quick-start---run-all-tests)
4. [Test Scripts](#test-scripts)
5. [Test Reports](#test-reports)
6. [Testing Checklist](#testing-checklist)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This document provides comprehensive testing documentation for PyIDE Phase 1 MVP. It includes:

- **Integration test suite** for automated testing
- **Manual testing checklists** for UI/UX verification
- **Test environment setup** instructions
- **Historical test reports** and results

### Test Coverage

| Component | Test Type | Status |
|-----------|-----------|--------|
| PyKernel WebSocket Server | Automated | ✅ Passing |
| Code Execution Engine | Automated | ✅ Passing |
| Variable Management | Automated | ✅ Passing |
| Error Handling | Automated | ✅ Passing |
| DataFrame Support | Automated | ✅ Passing |
| Tauri Desktop App | Manual | ✅ Verified |
| Monaco Editor | Manual | ✅ Verified |
| AI Chat Interface | Manual | ⚠️ Needs session persistence |
| File Management | Manual | ✅ Verified |
| Settings & Themes | Manual | ✅ Verified |

---

## Test Environment Setup

### Prerequisites

Before running tests, ensure you have the following installed:

#### Required Software
```bash
# Python (3.10+)
python --version
# Expected: Python 3.12.4 or higher

# Node.js (18+)
node --version
# Expected: v20.16.0 or higher

# npm
npm --version
# Expected: 10.8.1 or higher

# Rust (for Tauri development)
rustc --version
# Expected: rustc 1.94.1 or higher

cargo --version
# Expected: cargo 1.94.1 or higher

# uv (Python package manager)
uv --version
# Expected: uv 0.11.3 or higher
```

#### Install Missing Dependencies

**Install Rust:**
```powershell
# Windows PowerShell
Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "$env:TEMP\rustup-init.exe"
Start-Process -FilePath "$env:TEMP\rustup-init.exe" -ArgumentList "-y", "--default-toolchain", "stable" -Wait
```

**Install uv:**
```bash
pip install uv
```

**Install Python dependencies:**
```bash
cd packages/pykernel
pip install -e .
```

**Install Node dependencies:**
```bash
cd ../..
npm install
```

### Project Structure for Testing

```
python_ide1/
├── test/                                # Test directory
│   ├── README.md                       # Test suite documentation
│   ├── scripts/
│   │   ├── test_phase1_integration.py  # Main integration test suite
│   │   ├── test_kernel.py              # Basic kernel protocol test
│   │   └── generate_icons.py           # Icon generation utility
│   └── reports/
│       ├── PHASE1_INTEGRATION_TEST_REPORT.md  # Detailed test results
│       └── PHASE1_TEST_REPORT.md       # Initial testing report
├── packages/
│   └── pykernel/
│       ├── pykernel/
│       │   ├── ws_server.py            # WebSocket server
│       │   ├── executor.py             # Code execution engine
│       │   └── state_manager.py        # Variable state management
│       └── pyproject.toml
├── apps/
│   └── desktop/
│       ├── src/                         # React frontend
│       └── src-tauri/
│           └── src/                     # Rust backend
│               ├── kernel.rs           # Kernel management
│               ├── uv.rs               # uv integration
│               └── fs_commands.rs      # File operations
└── docs/
    ├── TESTING.md                      # This file
    └── README.md                       # Documentation index
```

---

## Quick Start - Run All Tests

### Option 1: Full Integration Test (Recommended)

This runs all automated tests in sequence:

```bash
# Terminal 1: Start PyKernel server
cd packages/pykernel
python -m pykernel --port 8765

# Terminal 2: Run integration tests
cd ../..
python test/scripts/test_phase1_integration.py
```

**Expected Output:**
```
============================================================
  PyIDE Phase 1 MVP Integration Test Suite
============================================================

[Test 1] Kernel Connection
  ✓ WebSocket connection established

[Test 2] Basic Code Execution
  ✓ Stream output received
  ✓ Execution completed
  ✓ Output content verified

... (more tests)

============================================================
Test Summary
============================================================
Total tests:  20
Passed:       19
Failed:        0
Warnings:      1
============================================================
✓ All critical tests passed!
```

### Option 2: Test Desktop Application

```bash
# Start Tauri dev mode (includes frontend + backend)
npm run dev

# The application will open automatically
# Manually test the UI features
```

### Option 3: Individual Component Tests

See [Test Scripts](#test-scripts) section below for individual test commands.

---

## Test Scripts

### 1. Integration Test Suite (`test_phase1_integration.py`)

**Purpose:** Comprehensive automated testing of all Phase 1 features

**What it tests:**
- ✅ WebSocket connection and protocol
- ✅ Code execution with output capture
- ✅ Variable inspection (single and bulk)
- ✅ Error handling and detection
- ✅ DataFrame rendering (pandas)
- ✅ Sequential execution tracking
- ✅ Interrupt command support

**Usage:**
```bash
# Start kernel first
python -m pykernel --port 8765

# Run tests
python test/scripts/test_phase1_integration.py
```

**Features:**
- Color-coded output (green=pass, red=fail, yellow=warning)
- Detailed test summaries
- Automatic error reporting
- Exit codes for CI/CD integration (0=success, 1=failure)

**Customization:**
Edit the `run_all_tests()` function to add/remove specific tests.

---

### 2. Basic Kernel Test (`test_kernel.py`)

**Purpose:** Quick smoke test for kernel connectivity

**What it tests:**
- WebSocket connection
- Simple code execution
- Variable inspection
- Variable listing

**Usage:**
```bash
python -m pykernel --port 8765  # Terminal 1
python test/scripts/test_kernel.py            # Terminal 2
```

**When to use:**
- Quick verification after kernel changes
- Protocol debugging
- Learning the JSON-RPC message format

---

### 3. Icon Generation (`generate_icons.py`)

**Purpose:** Generate placeholder icons for Tauri app

**What it creates:**
- `icons/32x32.png`
- `icons/128x128.png`
- `icons/128x128@2x.png`
- `icons/icon.ico` (Windows)
- `icons/icon.icns` (macOS placeholder)

**Usage:**
```bash
pip install Pillow
python test/scripts/generate_icons.py
```

**When to use:**
- Initial project setup
- Icon redesign
- Fixing missing icon errors

---

## Test Reports

### Phase 1 Integration Test Report

**Date:** April 5, 2026  
**Result:** ✅ PASSED (19/20 tests, 1 warning)

**Summary:**
- Total Tests: 20
- Passed: 19 (95%)
- Failed: 0 (0%)
- Warnings: 1 (5%)

**Key Findings:**
- All core functionality working correctly
- PyKernel WebSocket protocol fully operational
- Code execution, variable management, and error handling verified
- One minor warning: stderr output not captured for some syntax errors (non-critical)

**Performance Metrics:**
- Vite Dev Server startup: 400-740ms
- Rust compilation (incremental): 13-38 seconds
- Code execution: < 100ms for simple operations
- Variable inspection: < 50ms

**Full Report:** See [PHASE1_INTEGRATION_TEST_REPORT.md](./PHASE1_INTEGRATION_TEST_REPORT.md)

---

### Historical Test Results

| Date | Test Type | Result | Notes |
|------|-----------|--------|-------|
| Apr 5, 2026 | Integration Suite | ✅ PASS | 19/20 tests passed |
| Apr 5, 2026 | Kernel Protocol | ✅ PASS | All methods working |
| Apr 5, 2026 | Frontend Build | ✅ PASS | Vite build successful |
| Apr 5, 2026 | Tauri Compilation | ✅ PASS | Rust backend compiled |

---

## Testing Checklist

### Phase 1 MVP Feature Checklist

Use this checklist for manual testing of the desktop application:

#### Core Features

- [ ] **Application Launch**
  - [ ] App starts without errors
  - [ ] Window opens at correct size (1400x900)
  - [ ] Title bar shows "PyIDE"

- [ ] **Editor Functionality**
  - [ ] Monaco editor loads correctly
  - [ ] Can type and edit Python code
  - [ ] Syntax highlighting works
  - [ ] Line numbers visible
  - [ ] Can create new files
  - [ ] Can save files (Ctrl+S)
  - [ ] Multiple tabs work

- [ ] **Cell System (#%%)**
  - [ ] Cells are recognized in code
  - [ ] Cell toolbar appears on hover
  - [ ] Can run individual cells (Ctrl+Enter)
  - [ ] Cell execution highlights current cell

- [ ] **Code Execution**
  - [ ] Kernel connects automatically
  - [ ] Status bar shows kernel status
  - [ ] Code executes without errors
  - [ ] Output appears in output panel
  - [ ] Can interrupt execution

- [ ] **Output Rendering**
  - [ ] Text output displays correctly
  - [ ] DataFrame renders as table (AG Grid)
  - [ ] Plots render (Plotly charts)
  - [ ] Errors display with formatting
  - [ ] [AI Fix] button appears on errors

- [ ] **Variables Panel**
  - [ ] Variables list updates after execution
  - [ ] Variable types shown correctly
  - [ ] Can inspect variable values
  - [ ] Nested objects expand/collapse

- [ ] **File Management**
  - [ ] File tree shows project files
  - [ ] Can create new files
  - [ ] Can rename files
  - [ ] Can delete files
  - [ ] Recent files list updates

- [ ] **AI Chat**
  - [ ] Chat panel opens
  - [ ] Can send messages
  - [ ] AI responses stream in real-time
  - [ ] Code blocks render with syntax highlighting
  - [ ] [Execute] button on code blocks works
  - [ ] ⚠️ Session history persists (Phase 2)

- [ ] **Settings**
  - [ ] Settings dialog opens
  - [ ] Can configure AI provider (base_url, api_key, model)
  - [ ] Theme toggle works (dark/light/system)
  - [ ] Vim mode toggle works
  - [ ] Settings persist after restart

- [ ] **Environment Management**
  - [ ] uv detected correctly
  - [ ] No "uv not installed" warning
  - [ ] Can view virtual environments
  - [ ] Can create new venvs
  - [ ] Can switch between venvs

- [ ] **UI Layout**
  - [ ] Left sidebar resizable
  - [ ] Right panel resizable
  - [ ] Panels can be toggled on/off
  - [ ] Status bar shows relevant info
  - [ ] Theme applies correctly

#### Keyboard Shortcuts

- [ ] Ctrl+S - Save file
- [ ] Ctrl+Enter - Run current cell
- [ ] Shift+Enter - Run cell and move to next
- [ ] Ctrl+` - Toggle terminal/output
- [ ] Ctrl+B - Toggle left sidebar
- [ ] Ctrl+J - Toggle right panel

#### Edge Cases

- [ ] Large file handling (>1000 lines)
- [ ] Long-running execution (>30 seconds)
- [ ] Multiple rapid cell executions
- [ ] Invalid Python syntax
- [ ] Import errors
- [ ] Network disconnection (if using remote AI)
- [ ] Application restart preserves state

---

### Performance Testing Checklist

- [ ] **Startup Time**
  - [ ] App launches in < 5 seconds
  - [ ] First paint in < 2 seconds
  - [ ] Editor ready in < 3 seconds

- [ ] **Responsiveness**
  - [ ] Typing feels smooth (no lag)
  - [ ] Scrolling is fluid
  - [ ] Panel resizing is responsive
  - [ ] No UI freezes during execution

- [ ] **Memory Usage**
  - [ ] Memory usage stable over time
  - [ ] No memory leaks after extended use
  - [ ] Garbage collection works properly

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "uv is not installed" warning

**Symptoms:** Yellow warning banner in UI

**Solution:**
```bash
# Install uv via pip
pip install uv

# Verify installation
uv --version

# Restart the application
```

**If still not detected:** The app now checks multiple locations including Anaconda Scripts directory. If issue persists, verify uv.exe exists in one of these locations:
- `%USERPROFILE%\anaconda3\Scripts\uv.exe`
- `%USERPROFILE%\miniconda3\Scripts\uv.exe`
- `%USERPROFILE%\.local\bin\uv.exe`

---

#### Issue: Rust compilation fails

**Symptoms:** `cargo metadata` command not found

**Solution:**
```powershell
# Ensure Rust is in PATH
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

# Verify installation
rustc --version
cargo --version

# Retry
npm run dev
```

---

#### Issue: Port 1420 already in use

**Symptoms:** `Error: Port 1420 is already in use`

**Solution:**
```powershell
# Kill existing processes
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force

# Or find what's using port 1420
netstat -ano | findstr :1420

# Kill the specific process
taskkill /PID <PID> /F
```

---

#### Issue: PyKernel won't start

**Symptoms:** `ModuleNotFoundError: No module named 'websockets'`

**Solution:**
```bash
cd packages/pykernel
pip install -e .

# Verify installation
python -m pykernel --help
```

---

#### Issue: Icons missing error

**Symptoms:** `icons/icon.ico not found`

**Solution:**
```bash
pip install Pillow
python test/scripts/generate_icons.py
```

---

#### Issue: WebSocket connection refused

**Symptoms:** Tests fail with "Connection refused"

**Solution:**
1. Ensure PyKernel is running:
   ```bash
   python -m pykernel --port 8765
   ```

2. Check if port is available:
   ```bash
   netstat -ano | findstr :8765
   ```

3. Try a different port:
   ```bash
   python -m pykernel --port 8766
   # Update test script to use new port
   ```

---

#### Issue: TypeScript compilation errors

**Symptoms:** Red underlines in VS Code, build fails

**Solution:**
```bash
# Reinstall node modules
rm -rf node_modules
npm install

# Clear TypeScript cache
npx tsc --build --clean

# Rebuild
npm run vite:build
```

---

### Debug Mode

To enable debug logging:

**PyKernel:**
```bash
python -m pykernel --log-level DEBUG
```

**Tauri App:**
Open browser DevTools (F12) when running in dev mode to see console logs.

**Rust Backend:**
Add `println!` statements in Rust code, they appear in the terminal running `npm run dev`.

---

### Getting Help

If you encounter issues not covered here:

1. **Check existing issues:** Search GitHub issues for similar problems
2. **Review logs:** Check terminal output for error messages
3. **Verify environment:** Run `python test_phase1_integration.py` to check kernel
4. **Report bugs:** Create a new issue with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Python version, etc.)
   - Relevant log output

---

## Continuous Integration (Future)

For automated testing in CI/CD pipelines:

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.12'
    
    - name: Setup Node
      uses: actions/setup-node@v3
      with:
        node-version: '20'
    
    - name: Setup Rust
      uses: dtolnay/rust-toolchain@stable
    
    - name: Install dependencies
      run: |
        pip install uv
        cd packages/pykernel
        pip install -e .
        cd ../..
        npm install
    
    - name: Run integration tests
      run: |
        Start-Process python -ArgumentList "-m", "pykernel", "--port", "8765"
        Start-Sleep -Seconds 2
        python test/scripts/test_phase1_integration.py
```

---

## Contributing Tests

### Adding New Tests

1. **Integration Tests:** Add new async functions to `test_phase1_integration.py`
2. **Unit Tests:** Create `*.test.ts` files for TypeScript components
3. **E2E Tests:** Use Playwright for full user workflow testing

### Test Guidelines

- Each test should be independent and idempotent
- Use descriptive test names
- Include both positive and negative test cases
- Add assertions for expected behavior
- Clean up resources after tests

### Running Specific Tests

Edit `run_all_tests()` in `test_phase1_integration.py` to comment out tests you don't want to run:

```python
async def run_all_tests():
    ws = await test_kernel_connection(result)
    await test_basic_execution(ws, result)
    # await test_variable_inspection(ws, result)  # Skip this test
    await test_list_variables(ws, result)
    # ... rest of tests
```

---

## Appendix

### A. JSON-RPC Message Examples

**Execute Code:**
```json
{
  "id": "exec-123",
  "method": "execute",
  "params": {
    "code": "print('Hello, World!')"
  }
}
```

**Response:**
```json
{
  "stream": "stdout",
  "data": {
    "text/plain": "Hello, World!\n"
  }
}
```

**Execution Complete:**
```json
{
  "id": "exec-123",
  "result": {
    "status": "ok",
    "execution_count": 1
  }
}
```

### B. Test Data Files

Create test Python files in your workspace:

**test_basic.py:**
```python
#%% Basic arithmetic
x = 10 + 20
print(f'Result: {x}')

#%% Variables
a = 100
b = 'hello'
c = [1, 2, 3]

#%% DataFrame
import pandas as pd
df = pd.DataFrame({'A': [1, 2, 3], 'B': [4, 5, 6]})
print(df)
```

### C. Performance Benchmarks

**Reference Times (Windows 25H2, Intel i7):**

| Operation | Expected Time |
|-----------|---------------|
| App startup | < 5 seconds |
| Vite dev server | < 1 second |
| Rust compilation (first) | ~3 minutes |
| Rust compilation (incremental) | 13-38 seconds |
| Simple code execution | < 100ms |
| Variable inspection | < 50ms |
| DataFrame creation | < 200ms |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Apr 5, 2026 | Initial test documentation for Phase 1 MVP |

---

**Maintained by:** PyIDE Development Team  
**License:** MIT  
**Repository:** https://github.com/your-org/pyide
