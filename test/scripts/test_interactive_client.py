"""
Interactive WebSocket client for testing PyKernel.

This script provides a simple REPL-like interface to interact with PyKernel
using its native JSON-RPC WebSocket protocol.

Usage:
    python test_interactive_client.py [--port 8765]
"""

import asyncio
import json
import sys
import websockets


class PyKernelClient:
    """Interactive client for PyKernel WebSocket protocol."""

    def __init__(self, host: str = "127.0.0.1", port: int = 8765):
        self.uri = f"ws://{host}:{port}"
        self.ws = None
        self.request_id = 0

    async def connect(self):
        """Connect to PyKernel WebSocket server."""
        print(f"Connecting to {self.uri}...")
        try:
            self.ws = await asyncio.wait_for(
                websockets.connect(self.uri), timeout=3.0
            )
            print("✅ Connected to PyKernel!\n")
            print("Type Python code and press Enter to execute.")
            print("Commands:")
            print("  %vars     - List all variables")
            print("  %inspect <name> - Inspect a variable")
            print("  %quit     - Exit\n")
        except Exception as e:
            print(f"❌ Failed to connect: {e}")
            print("Make sure PyKernel is running:")
            print("  python -m pykernel --port 8765")
            sys.exit(1)

    async def disconnect(self):
        """Disconnect from PyKernel."""
        if self.ws:
            await self.ws.close()
            print("\nDisconnected from PyKernel.")

    def _next_id(self) -> str:
        """Generate unique request ID."""
        self.request_id += 1
        return f"req_{self.request_id}"

    async def execute_code(self, code: str):
        """Execute Python code and display outputs."""
        request = {
            "id": self._next_id(),
            "method": "execute",
            "params": {"code": code}
        }

        await self.ws.send(json.dumps(request))

        # Receive streaming outputs
        while True:
            try:
                response = await asyncio.wait_for(
                    self.ws.recv(), timeout=5.0
                )
                data = json.loads(response)

                # Stream output (stdout, stderr, etc.)
                if "stream" in data:
                    stream_type = data["stream"]
                    text = data.get("data", {}).get("text/plain", "")
                    if stream_type == "stdout":
                        print(text, end="")
                    elif stream_type == "stderr":
                        print(f"\033[91m{text}\033[0m", end="")  # Red color
                    elif stream_type == "display_data":
                        print(f"[Display]: {text}")

                # Execution complete
                elif "result" in data and "status" in data["result"]:
                    status = data["result"]["status"]
                    exec_count = data["result"].get("execution_count", 0)
                    if status == "ok":
                        print(f"\n✅ Execution #{exec_count} completed")
                    elif status == "error":
                        error = data["result"].get("ename", "Unknown error")
                        print(f"\n❌ Error: {error}")
                    break

                # Error response
                elif "error" in data:
                    error_msg = data["error"].get("message", "Unknown error")
                    print(f"\n❌ Kernel error: {error_msg}")
                    break

            except asyncio.TimeoutError:
                print("\n⏱️ Timeout waiting for response")
                break

    async def list_variables(self):
        """List all variables in kernel namespace."""
        request = {
            "id": self._next_id(),
            "method": "inspect_all",
            "params": {}
        }

        await self.ws.send(json.dumps(request))

        try:
            response = await asyncio.wait_for(self.ws.recv(), timeout=3.0)
            data = json.loads(response)

            if "result" in data and "variables" in data["result"]:
                variables = data["result"]["variables"]
                if not variables:
                    print("\n📋 No variables in namespace")
                else:
                    print(f"\n📋 Variables ({len(variables)}):")
                    print(f"{'Name':<20} {'Type':<15} {'Value':<30}")
                    print("-" * 65)
                    for var in variables:
                        name = var.get("name", "")
                        vtype = var.get("type", "")
                        value = var.get("value_preview", "")[:28]
                        print(f"{name:<20} {vtype:<15} {value:<30}")
            else:
                print(f"\n❌ Unexpected response: {data}")

        except asyncio.TimeoutError:
            print("\n⏱️ Timeout waiting for response")

    async def inspect_variable(self, name: str):
        """Inspect a specific variable."""
        request = {
            "id": self._next_id(),
            "method": "inspect",
            "params": {"name": name}
        }

        await self.ws.send(json.dumps(request))

        try:
            response = await asyncio.wait_for(self.ws.recv(), timeout=3.0)
            data = json.loads(response)

            if "result" in data:
                result = data["result"]
                print(f"\n🔍 Variable: {result.get('name')}")
                print(f"   Type: {result.get('type')}")
                print(f"   Value: {result.get('value_preview')}")
                print(f"   Size: {result.get('size')} bytes")
            else:
                print(f"\n❌ Unexpected response: {data}")

        except asyncio.TimeoutError:
            print("\n⏱️ Timeout waiting for response")

    async def interactive_loop(self):
        """Run interactive REPL loop."""
        multiline_code = []
        in_multiline = False

        while True:
            try:
                # Prompt
                if in_multiline:
                    prompt = "... "
                else:
                    prompt = ">>> "

                user_input = input(prompt).strip()

                # Empty line in multiline mode -> execute
                if in_multiline and not user_input:
                    code = "\n".join(multiline_code)
                    multiline_code = []
                    in_multiline = False
                    await self.execute_code(code)
                    continue

                # Commands
                if user_input == "%quit":
                    break
                elif user_input == "%vars":
                    await self.list_variables()
                    continue
                elif user_input.startswith("%inspect "):
                    var_name = user_input[9:].strip()
                    if var_name:
                        await self.inspect_variable(var_name)
                    else:
                        print("Usage: %inspect <variable_name>")
                    continue

                # Check for multiline (incomplete syntax)
                if user_input.endswith(":") or user_input.endswith("\\"):
                    if not in_multiline:
                        multiline_code.append(user_input)
                        in_multiline = True
                        continue
                    else:
                        multiline_code.append(user_input)
                        continue

                # Single line execution
                if in_multiline:
                    multiline_code.append(user_input)
                else:
                    await self.execute_code(user_input)

            except KeyboardInterrupt:
                print("\n\n⚠️  Interrupted. Type %quit to exit.")
            except EOFError:
                break


async def main():
    """Main entry point."""
    host = "127.0.0.1"
    port = 8765

    # Parse command line args
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            port = int(sys.argv[idx + 1])

    client = PyKernelClient(host, port)
    await client.connect()

    try:
        await client.interactive_loop()
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
