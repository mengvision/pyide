"""
conftest.py — pytest configuration and shared fixtures for PyIDE test suite.

Provides:
  - result   : A TestResult instance compatible with all 7 test suites.
                Has a finalizer that causes pytest to FAIL if any sub-test failed.
  - ws       : An async WebSocket connection to PyKernel (ws://127.0.0.1:8765).
                Skips the test if PyKernel is not running.
  - asyncio mode configured for pytest-asyncio.
"""

import asyncio
import pytest

# ---------------------------------------------------------------------------
# pytest-asyncio mode
# ---------------------------------------------------------------------------
# Make all async test functions in this directory auto-detected.
# Compatible with pytest-asyncio >= 0.18.
# ---------------------------------------------------------------------------


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "asyncio: mark test as async (handled by pytest-asyncio)"
    )


# Tell pytest-asyncio to run in "auto" mode so every async def test_ is treated
# as an asyncio test without needing @pytest.mark.asyncio on each one.
# This is done via the ini option below; we also set it here as a fallback.
try:
    import pytest_asyncio  # noqa: F401
    # Will be overridden by pyproject.toml / pytest.ini if present.
    # Setting via hook is the most portable approach.
except ImportError:
    pass


# ---------------------------------------------------------------------------
# Unified TestResult class
# ---------------------------------------------------------------------------

class TestResult:
    """
    A TestResult compatible with every test file's usage pattern:

    Files that use list-based passed/failed/warnings
    (test_mcp_capabilities, test_memory_capabilities, test_skills_capabilities):
        result.passed  → list of (name, details) tuples
        result.failed  → list of (name, error)  tuples
        result.warnings → list of (name, warning) tuples

    Files that use int-based counters
    (test_phase1_integration, test_e2e_integration):
        Those files define their own class internally; when pytest injects
        *this* fixture instead, it must satisfy both interfaces.
        We expose .passed / .failed / .warnings as lists AND provide
        integer-like len() semantics by making them list-based.

    The finalizer asserts len(self.failed) == 0.
    """

    def __init__(self):
        self.passed: list = []
        self.failed: list = []
        self.warnings: list = []

    # -- primary API used by test_mcp_*, test_memory_*, test_skills_* --------

    def add_pass(self, test_name: str, *args):
        details = " | ".join(str(a) for a in args) if args else ""
        self.passed.append((test_name, details))
        print(f"  ✓ PASS: {test_name}" + (f" — {details}" if details else ""))

    def add_fail(self, test_name: str, *args):
        error = " | ".join(str(a) for a in args) if args else ""
        self.failed.append((test_name, error))
        print(f"  ✗ FAIL: {test_name}" + (f" — {error}" if error else ""))

    def add_warning(self, test_name: str, *args):
        warning = " | ".join(str(a) for a in args) if args else ""
        self.warnings.append((test_name, warning))
        print(f"  ⚠ WARN: {test_name}" + (f" — {warning}" if warning else ""))

    def summary(self) -> bool:
        total = len(self.passed) + len(self.failed) + len(self.warnings)
        print(f"\n{'='*60}")
        print(f"Test Summary")
        print(f"{'='*60}")
        print(f"Total:    {total}")
        print(f"Passed:   {len(self.passed)}")
        print(f"Failed:   {len(self.failed)}")
        print(f"Warnings: {len(self.warnings)}")
        print(f"{'='*60}")
        return len(self.failed) == 0


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def result(request):
    """
    Provides a TestResult instance for the test.
    Finalizer asserts no failures so pytest reports FAIL when sub-tests fail.
    """
    tr = TestResult()
    yield tr

    # --- finalizer ---
    if tr.failed:
        failed_names = [name for name, *_ in tr.failed]
        pytest.fail(
            f"{len(tr.failed)} sub-test(s) failed:\n"
            + "\n".join(f"  - {n}" for n in failed_names),
            pytrace=False,
        )


# ---------------------------------------------------------------------------
# WebSocket fixture (async, skips when PyKernel is not running)
# ---------------------------------------------------------------------------

@pytest.fixture()
async def ws():
    """
    Async fixture that yields an open WebSocket connection to PyKernel.

    If PyKernel is not running on ws://127.0.0.1:8765 the test is skipped
    rather than failed, because CI environments don't have the kernel running.
    """
    try:
        import websockets  # type: ignore
    except ImportError:
        pytest.skip("websockets package not installed")

    uri = "ws://127.0.0.1:8765"
    try:
        connection = await asyncio.wait_for(
            websockets.connect(uri, ping_interval=None),
            timeout=3.0,
        )
    except Exception as exc:
        pytest.skip(f"PyKernel not running at {uri}: {exc}")

    try:
        yield connection
    finally:
        try:
            await connection.close()
        except Exception:
            pass
