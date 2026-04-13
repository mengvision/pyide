#!/usr/bin/env python3
"""
Mock MCP Server for Testing
Implements a simple MCP server that responds to tools/list and tools/call
"""

import sys
import json

def send_response(response):
    """Send a JSON-RPC response to stdout"""
    print(json.dumps(response), flush=True)

def handle_request(request):
    """Handle incoming JSON-RPC request"""
    request_id = request.get('id')
    method = request.get('method')
    params = request.get('params', {})
    
    if method == 'tools/list':
        # Return list of available tools
        response = {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "tools": [
                    {
                        "name": "read_file",
                        "description": "Read contents of a file",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "path": {
                                    "type": "string",
                                    "description": "Path to the file"
                                }
                            },
                            "required": ["path"]
                        }
                    },
                    {
                        "name": "write_file",
                        "description": "Write content to a file",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "path": {
                                    "type": "string",
                                    "description": "Path to the file"
                                },
                                "content": {
                                    "type": "string",
                                    "description": "Content to write"
                                }
                            },
                            "required": ["path", "content"]
                        }
                    },
                    {
                        "name": "list_directory",
                        "description": "List files in a directory",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "path": {
                                    "type": "string",
                                    "description": "Path to the directory"
                                }
                            },
                            "required": ["path"]
                        }
                    }
                ]
            }
        }
        send_response(response)
        
    elif method == 'tools/call':
        tool_name = params.get('name')
        arguments = params.get('arguments', {})
        
        # Simulate tool execution
        if tool_name == 'read_file':
            result = {
                "content": [
                    {
                        "type": "text",
                        "text": f"Mock content of file: {arguments.get('path', 'unknown')}"
                    }
                ]
            }
        elif tool_name == 'write_file':
            result = {
                "content": [
                    {
                        "type": "text",
                        "text": f"Successfully wrote {len(arguments.get('content', ''))} bytes to {arguments.get('path', 'unknown')}"
                    }
                ]
            }
        elif tool_name == 'list_directory':
            result = {
                "content": [
                    {
                        "type": "text",
                        "text": f"Files in {arguments.get('path', '.')}: file1.txt, file2.py, subdir/"
                    }
                ]
            }
        else:
            result = {
                "error": {
                    "code": -32601,
                    "message": f"Unknown tool: {tool_name}"
                }
            }
        
        response = {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": result
        }
        send_response(response)
        
    else:
        # Unknown method
        response = {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}"
            }
        }
        send_response(response)

def main():
    """Main loop - read requests from stdin, send responses to stdout"""
    print("Mock MCP Server started", file=sys.stderr)
    
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        try:
            request = json.loads(line)
            handle_request(request)
        except json.JSONDecodeError as e:
            error_response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": f"Parse error: {str(e)}"
                }
            }
            send_response(error_response)
        except Exception as e:
            error_response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                }
            }
            send_response(error_response)

if __name__ == "__main__":
    main()
