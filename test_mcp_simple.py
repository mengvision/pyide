"""
Simple test for DataHub MCP tools discovery
"""
import subprocess
import json
import time
import sys
import os

def test_mcp():
    env = os.environ.copy()
    env['DATAHUB_GMS_URL'] = 'http://192.168.38.121:8080'
    env['DATAHUB_GMS_TOKEN'] = 'eyJhbGciOiJIUzI1NiJ9.eyJhY3RvclR5cGUiOiJVU0VSIiwiYWN0b3JJZCI6Im1lbmdzaGlxdWFuQGFuZ2VsYWxpZ24uY29tIiwidHlwZSI6IlBFUlNPTkFMIiwidmVyc2lvbiI6IjIiLCJqdGkiOiIyMzY2NzAzMS0zODI2LTRiNjYtOTEyMi1hMWVkNWJlOTE1OTAiLCJzdWIiOiJtZW5nc2hpcXVhbkBhbmdlbGFsaWduLmNvbSIsImlzcyI6ImRhdGFodWItbWV0YWRhdGEtc2VydmljZSJ9.uCuYc-W8ksQuzfkOPRGvxojtq8QblBRIJgNs0mQ7rL4'
    
    print("Starting DataHub MCP server...")
    process = subprocess.Popen(
        ['uvx', 'mcp-server-datahub@latest'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
        bufsize=1
    )
    
    print(f"Started with PID: {process.pid}")
    time.sleep(3)  # Wait for server to start
    
    # Initialize
    init_msg = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0"}
        }
    }) + '\n'
    
    process.stdin.write(init_msg)
    process.stdin.flush()
    print("Sent initialize")
    time.sleep(2)
    
    # Read initialize response
    response = process.stdout.readline()
    print(f"Initialize response: {response}")
    
    # Send initialized notification
    notif = json.dumps({
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    }) + '\n'
    
    process.stdin.write(notif)
    process.stdin.flush()
    print("Sent initialized notification")
    time.sleep(1)
    
    # List tools
    tools_msg = json.dumps({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list"
    }) + '\n'
    
    process.stdin.write(tools_msg)
    process.stdin.flush()
    print("Sent tools/list")
    time.sleep(5)
    
    # Read tools response
    response = process.stdout.readline()
    if response:
        try:
            data = json.loads(response)
            if 'result' in data:
                tools = data['result'].get('tools', [])
                print(f"\n✅ Discovered {len(tools)} tools:")
                for tool in tools:
                    print(f"  - {tool['name']}: {tool.get('description', 'N/A')}")
            else:
                print(f"Response: {data}")
        except json.JSONDecodeError as e:
            print(f"Failed to parse: {e}")
            print(f"Raw: {response}")
    else:
        print("No response received")
    
    # Check stderr
    stderr_output = process.stderr.readline()
    if stderr_output:
        print(f"\nStderr: {stderr_output}")
    
    process.terminate()
    print("\nTest completed")

if __name__ == '__main__':
    test_mcp()
