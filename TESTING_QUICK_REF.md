# PyIDE Test Documentation - Quick Reference

## 📚 Complete Testing Guide

All testing documentation has been consolidated into a single comprehensive guide:

**📖 [docs/TESTING.md](./docs/TESTING.md)** - Complete testing documentation including:
- Test environment setup
- Quick start guides
- All test scripts and how to use them
- Manual testing checklists
- Troubleshooting guide
- CI/CD integration examples

---

## 🚀 Quick Start

### Run All Tests (2 minutes)

```bash
# Terminal 1: Start kernel
cd packages/pykernel
python -m pykernel --port 8765

# Terminal 2: Run tests
cd ../..
python test/scripts/test_phase1_integration.py
```

**Expected Result:** ✅ 19/20 tests pass (1 non-critical warning)

---

## 📁 Test Files Overview

All test files are organized in the `/test` directory:

```
test/
├── README.md                              # Test suite documentation
├── scripts/
│   ├── test_phase1_integration.py        # Main integration test suite
│   ├── test_kernel.py                     # Basic kernel smoke test
│   └── generate_icons.py                  # Icon generation utility
└── reports/
    ├── PHASE1_INTEGRATION_TEST_REPORT.md # Detailed test results
    └── PHASE1_TEST_REPORT.md             # Initial testing report
```

| File | Purpose | When to Use |
|------|---------|-------------||
| `test/scripts/test_phase1_integration.py` | Full automated test suite | Regular testing, CI/CD |
| `test/scripts/test_kernel.py` | Basic kernel smoke test | Quick verification |
| `test/scripts/generate_icons.py` | Generate app icons | Initial setup, icon updates |
| `test/README.md` | Test suite overview | Understanding test structure |
| `docs/TESTING.md` | Complete test documentation | Reference, troubleshooting |
| `test/reports/PHASE1_INTEGRATION_TEST_REPORT.md` | Detailed test results | Review, reporting |

---

## ✅ Phase 1 Test Status

**Overall:** ✅ PASSED

- **Automated Tests:** 19/20 passed (95%)
- **Manual Tests:** All core features verified
- **Performance:** Within acceptable parameters
- **Stability:** No critical issues found

---

## 🔧 Common Commands

```bash
# Install dependencies
npm install
pip install -e packages/pykernel

# Run desktop app
npm run dev

# Build for production
npm run build

# Run tests
python test/scripts/test_phase1_integration.py

# Check uv installation
uv --version

# Start kernel manually
python -m pykernel --port 8765
```

---

## 🐛 Troubleshooting

**Issue:** "uv not installed" warning  
**Fix:** `pip install uv` then restart app

**Issue:** Port already in use  
**Fix:** Kill node processes and retry

**Issue:** Rust compilation fails  
**Fix:** Ensure Rust is in PATH

See [docs/TESTING.md#troubleshooting](./docs/TESTING.md#troubleshooting) for complete troubleshooting guide.

---

## 📊 Test Reports

- **[test/reports/PHASE1_INTEGRATION_TEST_REPORT.md](./test/reports/PHASE1_INTEGRATION_TEST_REPORT.md)** - Detailed integration test results
- **[test/reports/PHASE1_TEST_REPORT.md](./test/reports/PHASE1_TEST_REPORT.md)** - Initial component testing report

---

## 🎯 Next Steps

Phase 1 is complete! Ready for:
1. User acceptance testing
2. Phase 2 development (cell visibility, chat history, etc.)
3. Production deployment (optional)

---

**Last Updated:** April 5, 2026  
**Version:** 0.1.0  
**Status:** Phase 1 MVP Complete ✅
