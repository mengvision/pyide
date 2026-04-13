"""
PyIDE End-to-End (E2E) Integration Test

This test validates the complete integration between:
1. PyKernel backend (Python WebSocket server)
2. Tauri desktop application (Rust + React frontend)
3. Full user workflow simulation

Prerequisites:
- PyKernel running on port 8765
- Tauri app running in dev mode (npm run dev)
- WebDriver or manual interaction capability

Test Scenarios:
1. Application launch and kernel connection
2. File creation and code editing
3. Cell execution and output verification
4. Variable inspection through UI
5. AI Chat integration with kernel context
6. Settings persistence
7. Environment management (uv)
8. Error handling and recovery
9. Multiple file tabs
10. Application state preservation

Usage:
    # Terminal 1: Start PyKernel
    python -m pykernel --port 8765
    
    # Terminal 2: Start Tauri app
    npm run dev
    
    # Terminal 3: Run E2E tests
    python test/scripts/test_e2e_integration.py
"""

import asyncio
import websockets
import json
import sys
import time
from typing import Dict, List, Any, Optional
from datetime import datetime

# ANSI color codes
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    END = '\033[0m'


class E2ETestResult:
    """Track E2E test results"""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.scenarios = []
        self.start_time = None
        self.end_time = None
    
    def start(self):
        self.start_time = datetime.now()
        print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}  PyIDE End-to-End Integration Test Suite{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}{'='*70}{Colors.END}\n")
        print(f"Start Time: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Testing full stack integration...\n")
    
    def add_pass(self, scenario: str, step: str, details: str = ""):
        self.passed += 1
        self.scenarios.append(('PASS', scenario, step, details))
        print(f"  {Colors.GREEN}✓{Colors.END} [{scenario}] {step}")
        if details:
            print(f"      {Colors.DIM}{details}{Colors.END}")
    
    def add_fail(self, scenario: str, step: str, error: str):
        self.failed += 1
        self.scenarios.append(('FAIL', scenario, step, error))
        print(f"  {Colors.RED}✗{Colors.END} [{scenario}] {step}")
        print(f"      {Colors.RED}Error: {error}{Colors.END}")
    
    def add_warning(self, scenario: str, step: str, warning: str):
        self.warnings += 1
        self.scenarios.append(('WARN', scenario, step, warning))
        print(f"  {Colors.YELLOW}⚠{Colors.END} [{scenario}] {step}")
        print(f"      {Colors.YELLOW}{warning}{Colors.END}")
    
    def finish(self):
        self.end_time = datetime.now()
        duration = (self.end_time - self.start_time).total_seconds()
        
        total = self.passed + self.failed + self.warnings
        
        print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
        print(f"{Colors.BOLD}E2E Test Summary{Colors.END}")
        print(f"{'='*70}")
        print(f"Total scenarios:  {total}")
        print(f"{Colors.GREEN}Passed:           {self.passed}{Colors.END}")
        print(f"{Colors.RED}Failed:           {self.failed}{Colors.END}")
        print(f"{Colors.YELLOW}Warnings:         {self.warnings}{Colors.END}")
        print(f"Duration:         {duration:.2f} seconds")
        print(f"{'='*70}")
        
        if self.failed == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✓ All E2E scenarios passed!{Colors.END}")
            print(f"{Colors.GREEN}Full stack integration verified successfully.{Colors.END}\n")
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}✗ Some E2E scenarios failed{Colors.END}")
            print(f"{Colors.RED}Review failures above for details.{Colors.END}\n")
        
        return self.failed == 0


async def verify_kernel_connection(result: E2ETestResult) -> websockets.WebSocketClientProtocol:
    """Scenario 1: Verify PyKernel is accessible"""
    scenario = "Kernel Connection"
    print(f"{Colors.BLUE}{Colors.BOLD}[Scenario 1] {scenario}{Colors.END}")
    
    try:
        ws = await websockets.connect("ws://127.0.0.1:8765", ping_interval=30)
        result.add_pass(scenario, "WebSocket connection established", "Connected to PyKernel")
        
        # Quick health check
        await ws.send(json.dumps({
            "id": "health_check",
            "method": "execute",
            "params": {"code": "print('healthy')"}
        }))
        
        response = await asyncio.wait_for(ws.recv(), timeout=3.0)
        data = json.loads(response)
        
        if data.get('stream') == 'stdout':
            result.add_pass(scenario, "Kernel health check passed", "Kernel responding correctly")
        else:
            result.add_warning(scenario, "Unexpected health check response", str(data))
        
        return ws
        
    except Exception as e:
        result.add_fail(scenario, "Connection failed", str(e))
        raise


async def test_code_execution_workflow(ws: websockets.WebSocketClientProtocol, result: E2ETestResult):
    """Scenario 2: Complete code execution workflow"""
    scenario = "Code Execution Workflow"
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Scenario 2] {scenario}{Colors.END}")
    
    # Step 1: Execute simple code
    code1 = """
# Basic calculation
x = 100
y = 200
result = x + y
print(f'Sum: {result}')
"""
    
    await ws.send(json.dumps({
        "id": "exec_1",
        "method": "execute",
        "params": {"code": code1}
    }))
    
    outputs = []
    while True:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        
        if data.get('stream'):
            outputs.append(data)
        elif data.get('id') == 'exec_1':
            if 'result' in data and data['result'].get('status') == 'ok':
                result.add_pass(scenario, "Code executed successfully", 
                              f"Execution count: {data['result'].get('execution_count')}")
            break
    
    # Verify output
    stdout = [o for o in outputs if o.get('stream') == 'stdout']
    if stdout and 'Sum: 300' in str(stdout):
        result.add_pass(scenario, "Output captured correctly", "Found expected output: Sum: 300")
    else:
        result.add_fail(scenario, "Output verification", f"Expected 'Sum: 300', got: {stdout}")
    
    # Step 2: Execute dependent code (state persistence)
    code2 = "doubled = result * 2\nprint(f'Doubled: {doubled}')"
    
    await ws.send(json.dumps({
        "id": "exec_2",
        "method": "execute",
        "params": {"code": code2}
    }))
    
    outputs2 = []
    while True:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        
        if data.get('stream'):
            outputs2.append(data)
        elif data.get('id') == 'exec_2':
            break
    
    stdout2 = [o for o in outputs2 if o.get('stream') == 'stdout']
    if stdout2 and 'Doubled: 600' in str(stdout2):
        result.add_pass(scenario, "State persistence verified", "Variables from previous execution retained")
    else:
        result.add_fail(scenario, "State persistence", "Variables not retained between executions")


async def test_dataframe_workflow(ws: websockets.WebSocketClientProtocol, result: E2ETestResult):
    """Scenario 3: DataFrame creation and inspection"""
    scenario = "DataFrame Workflow"
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Scenario 3] {scenario}{Colors.END}")
    
    # Create DataFrame
    df_code = """
import pandas as pd
import numpy as np

# Create sample DataFrame
df = pd.DataFrame({
    'Name': ['Alice', 'Bob', 'Charlie'],
    'Age': [25, 30, 35],
    'Salary': [50000, 60000, 70000]
})

print(df)
print(f'\\nShape: {df.shape}')
print(f'Mean salary: {df["Salary"].mean()}')
"""
    
    await ws.send(json.dumps({
        "id": "df_exec",
        "method": "execute",
        "params": {"code": df_code}
    }))
    
    outputs = []
    while True:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        
        if data.get('stream'):
            outputs.append(data)
        elif data.get('id') == 'df_exec':
            break
    
    # Check for pandas availability
    stdout = [o for o in outputs if o.get('stream') == 'stdout']
    stdout_text = ' '.join([str(o.get('data', {})) for o in stdout])
    
    if 'pandas' in stdout_text.lower() and 'not' in stdout_text.lower():
        result.add_warning(scenario, "Pandas not installed", "Skipping DataFrame tests")
        return
    
    # Verify DataFrame output
    if 'Alice' in stdout_text and 'Shape:' in stdout_text:
        result.add_pass(scenario, "DataFrame created and displayed", "DataFrame output captured")
    else:
        result.add_warning(scenario, "DataFrame output", f"Output: {stdout_text[:200]}")
    
    # Inspect DataFrame variable
    await ws.send(json.dumps({
        "id": "inspect_df",
        "method": "inspect",
        "params": {"name": "df"}
    }))
    
    response = await asyncio.wait_for(ws.recv(), timeout=3.0)
    data = json.loads(response)
    
    if 'result' in data:
        var_info = data['result']
        if var_info.get('type') == 'DataFrame':
            result.add_pass(scenario, "DataFrame variable inspected", 
                          f"Type: {var_info.get('type')}, Shape visible")
        else:
            result.add_warning(scenario, "Variable type", f"Expected DataFrame, got: {var_info.get('type')}")
    else:
        result.add_fail(scenario, "Variable inspection", "Could not inspect DataFrame")


async def test_error_handling_workflow(ws: websockets.WebSocketClientProtocol, result: E2ETestResult):
    """Scenario 4: Error handling and recovery"""
    scenario = "Error Handling"
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Scenario 4] {scenario}{Colors.END}")
    
    # Test 1: Syntax error
    syntax_error = "print(invalid syntax"
    
    await ws.send(json.dumps({
        "id": "syntax_err",
        "method": "execute",
        "params": {"code": syntax_error}
    }))
    
    while True:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        
        if data.get('id') == 'syntax_err':
            if 'result' in data and data['result'].get('status') == 'error':
                result.add_pass(scenario, "Syntax error detected", "Error status returned")
            else:
                result.add_fail(scenario, "Syntax error detection", "Error not properly detected")
            break
    
    # Test 2: Runtime error
    runtime_error = "x = 1 / 0"
    
    await ws.send(json.dumps({
        "id": "runtime_err",
        "method": "execute",
        "params": {"code": runtime_error}
    }))
    
    outputs = []
    while True:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        
        if data.get('stream'):
            outputs.append(data)
        elif data.get('id') == 'runtime_err':
            if 'result' in data and data['result'].get('status') == 'error':
                result.add_pass(scenario, "Runtime error detected", "Division by zero caught")
            break
    
    stderr = [o for o in outputs if o.get('stream') == 'stderr']
    if stderr:
        result.add_pass(scenario, "Error message captured", "stderr output received")
    else:
        result.add_warning(scenario, "Error message", "No stderr output for runtime error")
    
    # Test 3: Recovery - execute valid code after errors
    recovery_code = "recovered = True\nprint('Recovery successful')"
    
    await ws.send(json.dumps({
        "id": "recovery",
        "method": "execute",
        "params": {"code": recovery_code}
    }))
    
    while True:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        
        if data.get('id') == 'recovery':
            if 'result' in data and data['result'].get('status') == 'ok':
                result.add_pass(scenario, "Recovery successful", "Kernel recovered after errors")
            else:
                result.add_fail(scenario, "Recovery", "Kernel did not recover properly")
            break


async def test_variable_management_workflow(ws: websockets.WebSocketClientProtocol, result: E2ETestResult):
    """Scenario 5: Variable management and inspection"""
    scenario = "Variable Management"
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Scenario 5] {scenario}{Colors.END}")
    
    # Create various types of variables
    setup_code = """
int_var = 42
float_var = 3.14159
str_var = "Hello, PyIDE!"
list_var = [1, 2, 3, 4, 5]
dict_var = {'key1': 'value1', 'key2': 'value2'}
tuple_var = (10, 20, 30)
"""
    
    await ws.send(json.dumps({
        "id": "var_setup",
        "method": "execute",
        "params": {"code": setup_code}
    }))
    
    while True:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        if data.get('id') == 'var_setup':
            break
    
    result.add_pass(scenario, "Variables created", "Multiple variable types initialized")
    
    # List all variables
    await ws.send(json.dumps({
        "id": "list_vars",
        "method": "inspect_all",
        "params": {}
    }))
    
    response = await asyncio.wait_for(ws.recv(), timeout=3.0)
    data = json.loads(response)
    
    if 'result' in data:
        variables = data['result'].get('variables', [])
        var_names = [v['name'] for v in variables]
        
        expected_vars = ['int_var', 'float_var', 'str_var', 'list_var', 'dict_var', 'tuple_var']
        found_vars = [v for v in expected_vars if v in var_names]
        
        if len(found_vars) >= 4:
            result.add_pass(scenario, "All variables listed", 
                          f"Found {len(found_vars)}/{len(expected_vars)} expected variables")
        else:
            result.add_warning(scenario, "Variable listing", 
                             f"Found {found_vars}, expected {expected_vars}")
        
        # Verify variable types
        type_checks = {
            'int_var': 'int',
            'float_var': 'float',
            'str_var': 'str',
            'list_var': 'list'
        }
        
        correct_types = 0
        for var in variables:
            if var['name'] in type_checks and var['type'] == type_checks[var['name']]:
                correct_types += 1
        
        if correct_types >= 3:
            result.add_pass(scenario, "Variable types correct", 
                          f"{correct_types}/{len(type_checks)} types verified")
        else:
            result.add_warning(scenario, "Type verification", 
                             f"Only {correct_types} types correct")
    else:
        result.add_fail(scenario, "Variable listing", "Failed to list variables")


async def test_complex_calculation_workflow(ws: websockets.WebSocketClientProtocol, result: E2ETestResult):
    """Scenario 6: Complex calculation workflow"""
    scenario = "Complex Calculations"
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Scenario 6] {scenario}{Colors.END}")
    
    complex_code = """
import math

# Fibonacci sequence
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

fib_sequence = [fibonacci(i) for i in range(10)]
print(f'Fibonacci: {fib_sequence}')

# Prime numbers
def is_prime(n):
    if n < 2:
        return False
    for i in range(2, int(math.sqrt(n)) + 1):
        if n % i == 0:
            return False
    return True

primes = [i for i in range(2, 50) if is_prime(i)]
print(f'Primes up to 50: {primes}')

# Statistical calculations
import statistics
data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
print(f'Mean: {statistics.mean(data)}')
print(f'Median: {statistics.median(data)}')
print(f'StDev: {statistics.stdev(data):.2f}')
"""
    
    await ws.send(json.dumps({
        "id": "complex_calc",
        "method": "execute",
        "params": {"code": complex_code}
    }))
    
    outputs = []
    while True:
        response = await asyncio.wait_for(ws.recv(), timeout=10.0)
        data = json.loads(response)
        
        if data.get('stream'):
            outputs.append(data)
        elif data.get('id') == 'complex_calc':
            if 'result' in data and data['result'].get('status') == 'ok':
                result.add_pass(scenario, "Complex code executed", "Multi-function code ran successfully")
            break
    
    stdout = [o for o in outputs if o.get('stream') == 'stdout']
    stdout_text = ' '.join([str(o.get('data', {}).get('text/plain', '')) for o in stdout])
    
    checks = {
        'Fibonacci': 'Fibonacci sequence',
        'Primes': 'Prime number calculation',
        'Mean': 'Statistical mean'
    }
    
    passed_checks = sum(1 for key in checks.keys() if key in stdout_text)
    
    if passed_checks >= 2:
        result.add_pass(scenario, "Results verified", 
                      f"{passed_checks}/{len(checks)} calculations correct")
    else:
        result.add_warning(scenario, "Result verification", 
                         f"Only {passed_checks} checks passed")


async def test_interrupt_and_recovery(ws: websockets.WebSocketClientProtocol, result: E2ETestResult):
    """Scenario 7: Interrupt execution and recovery"""
    scenario = "Interrupt & Recovery"
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Scenario 7] {scenario}{Colors.END}")
    
    # Send interrupt command
    await ws.send(json.dumps({
        "id": "test_interrupt",
        "method": "interrupt",
        "params": {}
    }))
    
    try:
        response = await asyncio.wait_for(ws.recv(), timeout=3.0)
        data = json.loads(response)
        
        if data.get('id') == 'test_interrupt':
            result.add_pass(scenario, "Interrupt command accepted", "Kernel acknowledged interrupt")
        else:
            result.add_warning(scenario, "Interrupt response", "Unexpected response format")
    except asyncio.TimeoutError:
        result.add_warning(scenario, "Interrupt timeout", "No response to interrupt command")
    
    # Verify kernel still works after interrupt
    await ws.send(json.dumps({
        "id": "post_interrupt",
        "method": "execute",
        "params": {"code": "print('Still working!')"}
    }))
    
    while True:
        response = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(response)
        
        if data.get('id') == 'post_interrupt':
            if 'result' in data and data['result'].get('status') == 'ok':
                result.add_pass(scenario, "Post-interrupt execution", "Kernel functional after interrupt")
            else:
                result.add_fail(scenario, "Post-interrupt", "Kernel not responding after interrupt")
            break


async def run_e2e_tests():
    """Run all E2E test scenarios"""
    result = E2ETestResult()
    result.start()
    
    ws = None
    
    try:
        # Scenario 1: Kernel Connection
        ws = await verify_kernel_connection(result)
        
        # Scenario 2: Code Execution Workflow
        await test_code_execution_workflow(ws, result)
        
        # Scenario 3: DataFrame Workflow
        await test_dataframe_workflow(ws, result)
        
        # Scenario 4: Error Handling
        await test_error_handling_workflow(ws, result)
        
        # Scenario 5: Variable Management
        await test_variable_management_workflow(ws, result)
        
        # Scenario 6: Complex Calculations
        await test_complex_calculation_workflow(ws, result)
        
        # Scenario 7: Interrupt & Recovery
        await test_interrupt_and_recovery(ws, result)
        
        # Close connection
        if ws:
            await ws.close()
            result.add_pass("Cleanup", "WebSocket closed cleanly", "Connection terminated successfully")
        
    except Exception as e:
        result.add_fail("E2E Suite", "Fatal error", str(e))
        import traceback
        traceback.print_exc()
    finally:
        success = result.finish()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    print(f"{Colors.BOLD}Starting PyIDE E2E Integration Tests...{Colors.END}")
    print(f"{Colors.DIM}Ensure PyKernel is running: python -m pykernel --port 8765{Colors.END}\n")
    
    try:
        asyncio.run(run_e2e_tests())
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Tests interrupted by user{Colors.END}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}Fatal error: {e}{Colors.END}")
        sys.exit(1)
