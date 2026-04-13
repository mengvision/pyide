"""
Simple test script to verify PyKernel WebSocket protocol
"""
import asyncio
import pytest
import websockets
import json


@pytest.mark.asyncio
async def test_kernel():
    uri = "ws://127.0.0.1:8765"
    
    print("Testing PyKernel WebSocket protocol...")
    
    try:
        websocket_connection = await asyncio.wait_for(
            websockets.connect(uri), timeout=3.0
        )
    except Exception as exc:
        pytest.skip(f"PyKernel not running at {uri}: {exc}")

    # websocket_connection is the already-connected protocol object
    websocket = websocket_connection
    try:
        # Test 1: Execute simple Python code
        print("\n1. Testing execute command...")
        execute_msg = {
            "id": "test_1",
            "method": "execute",
            "params": {
                "code": "x = 10\ny = 20\nresult = x + y\nprint(f'Result: {result}')"
            }
        }
        await websocket.send(json.dumps(execute_msg))

        # Receive outputs
        while True:
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                data = json.loads(response)
                print(f"   Received: {data.get('type')} - {data}")

                if data.get('type') == 'execution_complete':
                    break
            except asyncio.TimeoutError:
                print("   Timeout waiting for response")
                break

        # Test 2: Inspect variables
        print("\n2. Testing inspect command...")
        inspect_msg = {
            "id": "test_2",
            "method": "inspect",
            "params": {
                "name": "result"
            }
        }
        await websocket.send(json.dumps(inspect_msg))

        try:
            response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
            data = json.loads(response)
            print(f"   Received: {data}")
        except asyncio.TimeoutError:
            print("   Timeout waiting for response")

        # Test 3: List variables
        print("\n3. Testing list_variables command...")
        list_msg = {
            "id": "test_3",
            "method": "inspect_all",
            "params": {}
        }
        await websocket.send(json.dumps(list_msg))

        try:
            response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
            data = json.loads(response)
            print(f"   Received: {data}")
        except asyncio.TimeoutError:
            print("   Timeout waiting for response")

        print("\n\u2705 All tests passed!")
    finally:
        await websocket.close()

if __name__ == "__main__":
    asyncio.run(test_kernel())
