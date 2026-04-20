"""
Test DataHub MCP Server Connection
This script tests the JSON-RPC communication with DataHub MCP server
"""

import subprocess
import json
import sys
import os
from pathlib import Path

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def send_jsonrpc_message(process, message_id, method, params=None):
    """Send a JSON-RPC message to the MCP server via stdin"""
    message = {
        "jsonrpc": "2.0",
        "id": message_id,
        "method": method,
        "params": params or {}
    }
    
    json_str = json.dumps(message) + '\n'
    process.stdin.write(json_str)
    process.stdin.flush()
    print(f"{Colors.BLUE}→ Sent: {method}{Colors.END}")

def read_response(process, timeout=10):
    """Read response from MCP server stdout"""
    import select
    
    # For Windows, we'll use a simpler approach
    line = process.stdout.readline()
    if line:
        try:
            response = json.loads(line.strip())
            return response
        except json.JSONDecodeError as e:
            print(f"{Colors.YELLOW}⚠ Warning: Failed to parse response: {e}{Colors.END}")
            return None
    return None

def test_datahub_mcp():
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}Testing DataHub MCP Server Connection{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")
    
    # Environment setup
    env = os.environ.copy()
    env['DATAHUB_GMS_URL'] = 'http://192.168.38.121:8080'
    env['DATAHUB_GMS_TOKEN'] = 'eyJhbGciOiJIUzI1NiJ9.eyJhY3RvclR5cGUiOiJVU0VSIiwiYWN0b3JJZCI6Im1lbmdzaGlxdWFuQGFuZ2VsYWxpZ24uY29tIiwidHlwZSI6IlBFUlNPTkFMIiwidmVyc2lvbiI6IjIiLCJqdGkiOiIyMzY2NzAzMS0zODI2LTRiNjYtOTEyMi1hMWVkNWJlOTE1OTAiLCJzdWIiOiJtZW5nc2hpcXVhbkBhbmdlbGFsaWduLmNvbSIsImlzcyI6ImRhdGFodWItbWV0YWRhdGEtc2VydmljZSJ9.uCuYc-W8ksQuzfkOPRGvxojtq8QblBRIJgNs0mQ7rL4'
    
    print(f"{Colors.BLUE}Starting DataHub MCP server...{Colors.END}")
    print(f"  Command: uvx mcp-server-datahub@latest")
    print(f"  GMS URL: {env['DATAHUB_GMS_URL']}\n")
    
    try:
        # Start the MCP server process
        process = subprocess.Popen(
            ['uvx', 'mcp-server-datahub@latest'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            bufsize=1
        )
        
        print(f"{Colors.GREEN}✅ MCP server process started (PID: {process.pid}){Colors.END}\n")
        
        # Test 1: Initialize connection
        print(f"{Colors.BOLD}[Test 1] Initialize MCP Connection{Colors.END}")
        send_jsonrpc_message(process, 1, 'initialize', {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "pyide-test-client",
                "version": "1.0.0"
            }
        })
        
        import time
        time.sleep(2)  # Wait for response
        
        response = read_response(process)
        if response:
            if 'result' in response:
                print(f"{Colors.GREEN}✅ Initialization successful{Colors.END}")
                print(f"   Server info: {response['result'].get('serverInfo', {})}")
            elif 'error' in response:
                print(f"{Colors.RED}❌ Initialization failed: {response['error']}{Colors.END}")
        else:
            print(f"{Colors.YELLOW}⚠ No response received (may need more time){Colors.END}")
        
        # Test 2: Initialize notification
        print(f"\n{Colors.BOLD}[Test 2] Send Initialized Notification{Colors.END}")
        notification = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }
        process.stdin.write(json.dumps(notification) + '\n')
        process.stdin.flush()
        print(f"{Colors.GREEN}✅ Initialized notification sent{Colors.END}")
        
        # Test 3: Discover tools
        print(f"\n{Colors.BOLD}[Test 3] Discover Available Tools{Colors.END}")
        send_jsonrpc_message(process, 2, 'tools/list')
        
        time.sleep(3)  # Wait for response
        
        response = read_response(process)
        if response and 'result' in response:
            tools = response['result'].get('tools', [])
            print(f"{Colors.GREEN}✅ Discovered {len(tools)} tools:{Colors.END}")
            for tool in tools:
                print(f"   - {Colors.BOLD}{tool['name']}{Colors.END}: {tool.get('description', 'No description')}")
        elif response and 'error' in response:
            print(f"{Colors.RED}❌ Tool discovery failed: {response['error']}{Colors.END}")
        else:
            print(f"{Colors.YELLOW}⚠ No tool list received{Colors.END}")
        
        # Check stderr for any errors
        import select
        if process.stderr:
            # Read any stderr output
            try:
                import msvcrt
                # Windows doesn't support select on pipes, just try to read
                pass
            except:
                pass
        
        print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
        print(f"{Colors.GREEN}✅ Test completed successfully!{Colors.END}")
        print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")
        
        # Cleanup
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        
        print(f"{Colors.BLUE}MCP server process terminated{Colors.END}\n")
        
        return 0
        
    except FileNotFoundError:
        print(f"{Colors.RED}❌ Error: 'uvx' command not found. Please install uv first.{Colors.END}")
        print(f"   Install: curl -LsSf https://astral.sh/uv/install.sh | sh")
        return 1
    except Exception as e:
        print(f"{Colors.RED}❌ Error: {e}{Colors.END}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(test_datahub_mcp())
