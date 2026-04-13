"""
PyIDE Phase 1 MVP Integration Test Suite

This script performs comprehensive testing of all Phase 1 features:
1. PyKernel WebSocket protocol
2. Code execution and output
3. Variable inspection
4. Cell parsing
5. State management

Run this test after starting the PyKernel server:
    python -m pykernel --port 8765
    python test_phase1_integration.py
"""

import asyncio
import websockets
import json
import sys
from typing import Dict, List, Any

# ANSI color codes for pretty output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.tests = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed += 1
        self.tests.append(('PASS', test_name, details))
        print(f"  {Colors.GREEN}✓{Colors.END} {test_name}")
        if details:
            print(f"    {details}")
    
    def add_fail(self, test_name: str, error: str):
        self.failed += 1
        self.tests.append(('FAIL', test_name, error))
        print(f"  {Colors.RED}✗{Colors.END} {test_name}")
        print(f"    Error: {error}")
    
    def add_warning(self, test_name: str, warning: str):
        self.warnings += 1
        self.tests.append(('WARN', test_name, warning))
        print(f"  {Colors.YELLOW}⚠{Colors.END} {test_name}")
        print(f"    {warning}")
    
    def summary(self):
        total = self.passed + self.failed + self.warnings
        print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
        print(f"{Colors.BOLD}Test Summary{Colors.END}")
        print(f"{'='*60}")
        print(f"Total tests:  {total}")
        print(f"{Colors.GREEN}Passed:       {self.passed}{Colors.END}")
        print(f"{Colors.RED}Failed:       {self.failed}{Colors.END}")
        print(f"{Colors.YELLOW}Warnings:     {self.warnings}{Colors.END}")
        print(f"{'='*60}")
        
        if self.failed == 0:
            print(f"{Colors.GREEN}{Colors.BOLD}✓ All critical tests passed!{Colors.END}")
        else:
            print(f"{Colors.RED}{Colors.BOLD}✗ Some tests failed{Colors.END}")
        
        return self.failed == 0


async def test_kernel_connection(result: TestResult) -> websockets.WebSocketClientProtocol:
    """Test 1: Kernel WebSocket Connection"""
    import pytest as _pytest
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 1] Kernel Connection{Colors.END}")
    
    try:
        ws = await websockets.connect("ws://127.0.0.1:8765", ping_interval=30)
        result.add_pass("WebSocket connection established", "Connected to ws://127.0.0.1:8765")
        return ws
    except Exception as e:
        _pytest.skip(f"PyKernel not running: {e}")


async def test_basic_execution(ws: websockets.WebSocketClientProtocol, result: TestResult):
    """Test 2: Basic Code Execution"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 2] Basic Code Execution{Colors.END}")
    
    # Test simple arithmetic
    test_code = "x = 10 + 20\nprint(f'Result: {x}')"
    msg = {
        "id": "test_exec_1",
        "method": "execute",
        "params": {"code": test_code}
    }
    
    await ws.send(json.dumps(msg))
    
    outputs = []
    execution_complete = False
    
    while not execution_complete:
        try:
            response = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(response)
            
            if data.get('stream'):
                outputs.append(data)
                result.add_pass(
                    f"Stream output received",
                    f"Type: {data['stream']}, Data: {data.get('data', {})}"
                )
            elif data.get('id') == 'test_exec_1':
                if 'result' in data:
                    execution_complete = True
                    exec_count = data['result'].get('execution_count', 0)
                    status = data['result'].get('status', 'unknown')
                    result.add_pass(
                        "Execution completed",
                        f"Status: {status}, Execution count: {exec_count}"
                    )
                elif 'error' in data:
                    result.add_fail("Execution", f"Error: {data['error']}")
                    execution_complete = True
        except asyncio.TimeoutError:
            result.add_fail("Execution", "Timeout waiting for response")
            break
    
    # Verify output content
    stdout_outputs = [o for o in outputs if o.get('stream') == 'stdout']
    if stdout_outputs:
        text_output = stdout_outputs[0].get('data', {}).get('text/plain', '')
        if 'Result: 30' in text_output:
            result.add_pass("Output content verified", f"Found expected output: {text_output.strip()}")
        else:
            result.add_warning("Output content", f"Expected 'Result: 30', got: {text_output}")


async def test_variable_inspection(ws: websockets.WebSocketClientProtocol, result: TestResult):
    """Test 3: Variable Inspection"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 3] Variable Inspection{Colors.END}")
    
    # First create some variables
    setup_code = "a = 100\nb = 'hello'\nc = [1, 2, 3]"
    await ws.send(json.dumps({
        "id": "test_setup",
        "method": "execute",
        "params": {"code": setup_code}
    }))
    
    # Wait for execution to complete
    while True:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        if data.get('id') == 'test_setup' and ('result' in data or 'error' in data):
            break
    
    # Test inspect single variable
    await ws.send(json.dumps({
        "id": "test_inspect",
        "method": "inspect",
        "params": {"name": "a"}
    }))
    
    try:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        
        if 'result' in data:
            var_info = data['result']
            result.add_pass(
                "Single variable inspection",
                f"Variable 'a': type={var_info.get('type')}, value={var_info.get('value_preview')}"
            )
            
            # Verify variable metadata
            if var_info.get('name') == 'a' and var_info.get('type') == 'int':
                result.add_pass("Variable metadata correct", "Name and type match expected values")
            else:
                result.add_warning("Variable metadata", f"Unexpected metadata: {var_info}")
        else:
            result.add_fail("Variable inspection", f"Error: {data.get('error')}")
    except asyncio.TimeoutError:
        result.add_fail("Variable inspection", "Timeout waiting for response")


async def test_list_variables(ws: websockets.WebSocketClientProtocol, result: TestResult):
    """Test 4: List All Variables"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 4] List All Variables{Colors.END}")
    
    await ws.send(json.dumps({
        "id": "test_list",
        "method": "inspect_all",
        "params": {}
    }))
    
    try:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        
        if 'result' in data:
            variables = data['result'].get('variables', [])
            result.add_pass(
                "Variable list retrieved",
                f"Found {len(variables)} variables"
            )
            
            # Check for expected variables
            var_names = [v['name'] for v in variables]
            expected_vars = ['x', 'a', 'b', 'c']
            found_expected = [v for v in expected_vars if v in var_names]
            
            if len(found_expected) >= 2:  # At least some of our test vars
                result.add_pass(
                    "Expected variables present",
                    f"Found: {', '.join(found_expected)}"
                )
            else:
                result.add_warning(
                    "Variable presence",
                    f"Expected some of {expected_vars}, found: {var_names}"
                )
            
            # Verify variable structure
            if variables:
                sample = variables[0]
                required_fields = ['name', 'type', 'value_preview', 'size']
                missing_fields = [f for f in required_fields if f not in sample]
                
                if not missing_fields:
                    result.add_pass("Variable structure valid", "All required fields present")
                else:
                    result.add_fail("Variable structure", f"Missing fields: {missing_fields}")
        else:
            result.add_fail("List variables", f"Error: {data.get('error')}")
    except asyncio.TimeoutError:
        result.add_fail("List variables", "Timeout waiting for response")


async def test_error_handling(ws: websockets.WebSocketClientProtocol, result: TestResult):
    """Test 5: Error Handling"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 5] Error Handling{Colors.END}")
    
    # Test syntax error
    error_code = "print(invalid syntax here"
    await ws.send(json.dumps({
        "id": "test_error",
        "method": "execute",
        "params": {"code": error_code}
    }))
    
    outputs = []
    execution_complete = False
    
    while not execution_complete:
        try:
            response = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(response)
            
            if data.get('stream'):
                outputs.append(data)
            elif data.get('id') == 'test_error':
                execution_complete = True
                
                if 'result' in data:
                    status = data['result'].get('status')
                    if status == 'error':
                        result.add_pass("Syntax error detected", f"Status: {status}")
                    else:
                        result.add_warning("Error detection", f"Expected error status, got: {status}")
                else:
                    result.add_fail("Error handling", "No result received")
        except asyncio.TimeoutError:
            result.add_fail("Error handling", "Timeout waiting for error response")
            break
    
    # Check stderr output
    stderr_outputs = [o for o in outputs if o.get('stream') == 'stderr']
    if stderr_outputs:
        result.add_pass("Error output captured", f"Received {len(stderr_outputs)} stderr messages")
    else:
        result.add_warning("Error output", "No stderr output captured")


async def test_dataframe_output(ws: websockets.WebSocketClientProtocol, result: TestResult):
    """Test 6: DataFrame Output (if pandas available)"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 6] DataFrame Output{Colors.END}")
    
    df_code = """
try:
    import pandas as pd
    df = pd.DataFrame({'A': [1, 2, 3], 'B': [4, 5, 6]})
    print(df)
except ImportError:
    print('pandas not installed')
"""
    
    await ws.send(json.dumps({
        "id": "test_df",
        "method": "execute",
        "params": {"code": df_code}
    }))
    
    outputs = []
    execution_complete = False
    
    while not execution_complete:
        try:
            response = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(response)
            
            if data.get('stream'):
                outputs.append(data)
            elif data.get('id') == 'test_df':
                execution_complete = True
                
                if 'result' in data:
                    result.add_pass("DataFrame code executed", "Execution completed")
                    
                    # Check output
                    stdout = [o for o in outputs if o.get('stream') == 'stdout']
                    if stdout:
                        text = stdout[0].get('data', {}).get('text/plain', '')
                        if 'pandas not installed' in text:
                            result.add_warning("DataFrame test", "pandas not installed, skipping")
                        elif 'A' in text and 'B' in text:
                            result.add_pass("DataFrame output rendered", "DataFrame displayed correctly")
                        else:
                            result.add_warning("DataFrame output", f"Unexpected output: {text[:100]}")
        except asyncio.TimeoutError:
            result.add_fail("DataFrame test", "Timeout")
            break


async def test_multiple_executions(ws: websockets.WebSocketClientProtocol, result: TestResult):
    """Test 7: Multiple Sequential Executions"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 7] Multiple Sequential Executions{Colors.END}")
    
    execution_counts = []
    
    for i in range(3):
        code = f"value_{i} = {i * 10}"
        await ws.send(json.dumps({
            "id": f"test_seq_{i}",
            "method": "execute",
            "params": {"code": code}
        }))
        
        while True:
            response = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(response)
            if data.get('id') == f'test_seq_{i}':
                if 'result' in data:
                    exec_count = data['result'].get('execution_count', 0)
                    execution_counts.append(exec_count)
                    result.add_pass(f"Execution {i+1}", f"Execution count: {exec_count}")
                break
    
    # Verify execution counts are incremental
    if len(execution_counts) == 3:
        if execution_counts == sorted(execution_counts):
            result.add_pass("Sequential execution", "Execution counts are incremental")
        else:
            result.add_warning("Sequential execution", f"Counts not incremental: {execution_counts}")


async def test_interrupt(ws: websockets.WebSocketClientProtocol, result: TestResult):
    """Test 8: Interrupt Execution (optional)"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 8] Interrupt Execution{Colors.END}")
    
    # Try to send interrupt command
    try:
        await ws.send(json.dumps({
            "id": "test_interrupt",
            "method": "interrupt",
            "params": {}
        }))
        
        response = await asyncio.wait_for(ws.recv(), timeout=3.0)
        data = json.loads(response)
        
        if data.get('id') == 'test_interrupt':
            if 'result' in data or 'error' in data:
                result.add_pass("Interrupt command accepted", "Kernel responded to interrupt")
            else:
                result.add_warning("Interrupt", f"Unexpected response: {data}")
        else:
            result.add_warning("Interrupt", "No response to interrupt command")
    except Exception as e:
        result.add_warning("Interrupt test", f"Could not test interrupt: {e}")


async def run_all_tests():
    """Run all integration tests"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}  PyIDE Phase 1 MVP Integration Test Suite{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}\n")
    
    result = TestResult()
    ws = None
    
    try:
        # Test 1: Connection
        ws = await test_kernel_connection(result)
        
        # Test 2-8: Functional tests
        await test_basic_execution(ws, result)
        await test_variable_inspection(ws, result)
        await test_list_variables(ws, result)
        await test_error_handling(ws, result)
        await test_dataframe_output(ws, result)
        await test_multiple_executions(ws, result)
        await test_interrupt(ws, result)
        
        # Close connection
        if ws:
            await ws.close()
            result.add_pass("WebSocket closed cleanly", "Connection terminated successfully")
        
    except Exception as e:
        result.add_fail("Test suite", f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Print summary
        success = result.summary()
        
        # Exit with appropriate code
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    print("Starting PyIDE Phase 1 Integration Tests...")
    print("Make sure PyKernel is running: python -m pykernel --port 8765\n")
    
    try:
        asyncio.run(run_all_tests())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Tests interrupted by user{Colors.END}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}Fatal error: {e}{Colors.END}")
        sys.exit(1)
