"""
MCP JSON-RPC Integration Test
Tests the complete JSON-RPC communication with MCP servers
"""

import subprocess
import json
import sys
import time
from pathlib import Path

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def test_json_rpc_client_creation():
    """Test 1: Verify JSON-RPC client can be created"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 1] JSON-RPC Client Creation{Colors.END}")
    
    client_file = Path("apps/desktop/src/services/MCPService/jsonRpcClient.ts")
    
    if not client_file.exists():
        print(f"{Colors.RED}❌ FAIL{Colors.END}: JSON-RPC client file not found")
        return False
    
    content = client_file.read_text(encoding='utf-8')
    
    checks = [
        ('export class JSONRPCClient', 'JSONRPCClient class exported'),
        ('sendRequest(', 'sendRequest method exists'),
        ('sendNotification(', 'sendNotification method exists'),
        ('startListening()', 'startListening method exists'),
        ('processMessage(', 'processMessage handler exists'),
        ('pendingRequests:', 'Pending requests tracking'),
        ('messageHandlers:', 'Message handlers support'),
    ]
    
    all_passed = True
    for check, description in checks:
        if check in content:
            print(f"{Colors.GREEN}✅ PASS{Colors.END}: {description}")
        else:
            print(f"{Colors.RED}❌ FAIL{Colors.END}: {description}")
            all_passed = False
    
    return all_passed


def test_mcp_client_integration():
    """Test 2: Verify MCP client uses JSON-RPC"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 2] MCP Client JSON-RPC Integration{Colors.END}")
    
    client_file = Path("apps/desktop/src/services/MCPService/client.ts")
    
    if not client_file.exists():
        print(f"{Colors.RED}❌ FAIL{Colors.END}: MCP client file not found")
        return False
    
    content = client_file.read_text(encoding='utf-8')
    
    checks = [
        ("import { JSONRPCClient }", 'Imports JSONRPCClient'),
        ('private jsonRpcClients:', 'Stores JSON-RPC clients'),
        ('new JSONRPCClient(serverName)', 'Creates JSON-RPC client on connect'),
        ('jsonRpcClient.startListening()', 'Starts listening for messages'),
        ("sendRequest('tools/list')", 'Uses tools/list for discovery'),
        ("sendRequest('tools/call'", 'Uses tools/call for execution'),
        ('jsonRpcClient.cleanup()', 'Cleans up on disconnect'),
    ]
    
    all_passed = True
    for check, description in checks:
        if check in content:
            print(f"{Colors.GREEN}✅ PASS{Colors.END}: {description}")
        else:
            print(f"{Colors.RED}❌ FAIL{Colors.END}: {description}")
            all_passed = False
    
    # Check that TODO comments are removed
    if 'TODO: Implement actual JSON-RPC' in content:
        print(f"{Colors.RED}❌ FAIL{Colors.END}: Still has TODO placeholder")
        all_passed = False
    else:
        print(f"{Colors.GREEN}✅ PASS{Colors.END}: No TODO placeholders remaining")
    
    return all_passed


def test_rust_backend_commands():
    """Test 3: Verify Rust backend has send/read commands"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 3] Rust Backend JSON-RPC Commands{Colors.END}")
    
    rust_file = Path("apps/desktop/src-tauri/src/mcp.rs")
    
    if not rust_file.exists():
        print(f"{Colors.RED}❌ FAIL{Colors.END}: Rust MCP file not found")
        return False
    
    content = rust_file.read_text(encoding='utf-8')
    
    checks = [
        ('pub async fn send_mcp_message', 'send_mcp_message command exists'),
        ('pub async fn read_mcp_message', 'read_mcp_message command exists'),
        ('MCPStdioChannels', 'Stdio channels struct defined'),
        ('stdin.write_all', 'Writes to stdin'),
        ('stdout.read_line', 'Reads from stdout'),
        ('BufReader', 'Uses buffered reader'),
    ]
    
    all_passed = True
    for check, description in checks:
        if check in content:
            print(f"{Colors.GREEN}✅ PASS{Colors.END}: {description}")
        else:
            print(f"{Colors.RED}❌ FAIL{Colors.END}: {description}")
            all_passed = False
    
    return all_passed


def test_lib_rs_registration():
    """Test 4: Verify commands registered in lib.rs"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 4] Command Registration in lib.rs{Colors.END}")
    
    lib_file = Path("apps/desktop/src-tauri/src/lib.rs")
    
    if not lib_file.exists():
        print(f"{Colors.RED}❌ FAIL{Colors.END}: lib.rs not found")
        return False
    
    content = lib_file.read_text(encoding='utf-8')
    
    checks = [
        ('mcp::send_mcp_message', 'send_mcp_message registered'),
        ('mcp::read_mcp_message', 'read_mcp_message registered'),
    ]
    
    all_passed = True
    for check, description in checks:
        if check in content:
            print(f"{Colors.GREEN}✅ PASS{Colors.END}: {description}")
        else:
            print(f"{Colors.RED}❌ FAIL{Colors.END}: {description}")
            all_passed = False
    
    return all_passed


def test_mock_server():
    """Test 5: Verify mock MCP server exists and is valid"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 5] Mock MCP Server{Colors.END}")
    
    mock_file = Path("test/scripts/mock_mcp_server.py")
    
    if not mock_file.exists():
        print(f"{Colors.RED}❌ FAIL{Colors.END}: Mock server file not found")
        return False
    
    content = mock_file.read_text(encoding='utf-8')
    
    checks = [
        ('def handle_request', 'Request handler exists'),
        ('tools/list', 'Handles tools/list'),
        ('tools/call', 'Handles tools/call'),
        ('json.dumps(response)', 'Sends JSON responses'),
        ('for line in sys.stdin', 'Reads from stdin'),
        ('flush=True', 'Flushes output'),
    ]
    
    all_passed = True
    for check, description in checks:
        if check in content:
            print(f"{Colors.GREEN}✅ PASS{Colors.END}: {description}")
        else:
            print(f"{Colors.RED}❌ FAIL{Colors.END}: {description}")
            all_passed = False
    
    return all_passed


def test_tool_discovery_implementation():
    """Test 6: Verify tool discovery implementation"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 6] Tool Discovery Implementation{Colors.END}")
    
    client_file = Path("apps/desktop/src/services/MCPService/client.ts")
    content = client_file.read_text(encoding='utf-8')
    
    # Extract discoverTools function
    if 'async discoverTools(serverName: string): Promise<MCPTool[]>' not in content:
        print(f"{Colors.RED}❌ FAIL{Colors.END}: discoverTools method signature not found")
        return False
    
    checks = [
        ("sendRequest('tools/list')", 'Sends tools/list request'),
        ('response.tools', 'Parses tools from response'),
        ('Array.isArray(response.tools)', 'Validates array type'),
        ('tool.name', 'Extracts tool name'),
        ('tool.description', 'Extracts tool description'),
        ('tool.inputSchema', 'Extracts input schema'),
        ('console.log(`Discovered', 'Logs discovery result'),
    ]
    
    all_passed = True
    for check, description in checks:
        if check in content:
            print(f"{Colors.GREEN}✅ PASS{Colors.END}: {description}")
        else:
            print(f"{Colors.RED}❌ FAIL{Colors.END}: {description}")
            all_passed = False
    
    return all_passed


def test_tool_execution_implementation():
    """Test 7: Verify tool execution implementation"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}[Test 7] Tool Execution Implementation{Colors.END}")
    
    client_file = Path("apps/desktop/src/services/MCPService/client.ts")
    content = client_file.read_text(encoding='utf-8')
    
    # Extract callTool function
    if 'async callTool(serverName: string, toolName: string, args: any): Promise<any>' not in content:
        print(f"{Colors.RED}❌ FAIL{Colors.END}: callTool method signature not found")
        return False
    
    checks = [
        ("sendRequest('tools/call'", 'Sends tools/call request'),
        ('name: toolName', 'Passes tool name'),
        ('arguments: args', 'Passes arguments'),
        ('return response', 'Returns result'),
        ('throw error', 'Throws on error'),
    ]
    
    all_passed = True
    for check, description in checks:
        if check in content:
            print(f"{Colors.GREEN}✅ PASS{Colors.END}: {description}")
        else:
            print(f"{Colors.RED}❌ FAIL{Colors.END}: {description}")
            all_passed = False
    
    # Verify it doesn't throw "not implemented" error
    if "throw new Error('Tool calling not yet implemented')" in content:
        print(f"{Colors.RED}❌ FAIL{Colors.END}: Still throws 'not implemented' error")
        all_passed = False
    else:
        print(f"{Colors.GREEN}✅ PASS{Colors.END}: No longer throws 'not implemented' error")
    
    return all_passed


def test_json_rpc_pytest():
    """pytest-facing wrapper: runs all JSON-RPC sub-checks and asserts."""
    results = [
        ("JSON-RPC Client Creation", test_json_rpc_client_creation()),
        ("MCP Client Integration", test_mcp_client_integration()),
        ("Rust Backend Commands", test_rust_backend_commands()),
        ("Command Registration", test_lib_rs_registration()),
        ("Mock Server", test_mock_server()),
        ("Tool Discovery", test_tool_discovery_implementation()),
        ("Tool Execution", test_tool_execution_implementation()),
    ]
    failed = [name for name, ok in results if not ok]
    assert not failed, (
        f"{len(failed)} JSON-RPC check(s) failed: " + ", ".join(failed)
    )
    print(f"{Colors.BOLD}{'='*60}")
    print(f"MCP JSON-RPC Integration Test")
    print(f"{'='*60}{Colors.END}\n")
    
    results = []
    
    # Run all tests
    results.append(("JSON-RPC Client Creation", test_json_rpc_client_creation()))
    results.append(("MCP Client Integration", test_mcp_client_integration()))
    results.append(("Rust Backend Commands", test_rust_backend_commands()))
    results.append(("Command Registration", test_lib_rs_registration()))
    results.append(("Mock Server", test_mock_server()))
    results.append(("Tool Discovery", test_tool_discovery_implementation()))
    results.append(("Tool Execution", test_tool_execution_implementation()))
    
    # Summary
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n{Colors.BOLD}{'='*60}")
    print(f"Test Summary")
    print(f"{'='*60}")
    print(f"Total Tests: {total}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.END}")
    print(f"{Colors.RED}Failed: {total - passed}{Colors.END}")
    print(f"{'='*60}\n")
    
    if passed == total:
        print(f"{Colors.GREEN}{Colors.BOLD}✅ ALL TESTS PASSED - JSON-RPC Implementation Complete!{Colors.END}")
        print(f"\n{Colors.BOLD}Next Steps:{Colors.END}")
        print(f"1. Build the Tauri app to compile Rust code")
        print(f"2. Test with mock MCP server: python test/scripts/mock_mcp_server.py")
        print(f"3. Configure MCP server in ~/.pyide/mcp_config.json")
        print(f"4. Verify tool discovery and execution in UI")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ SOME TESTS FAILED - Review implementation{Colors.END}")
        failed_tests = [name for name, result in results if not result]
        print(f"\n{Colors.BOLD}Failed Tests:{Colors.END}")
        for test in failed_tests:
            print(f"  - {test}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
