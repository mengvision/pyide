"""WebSocket proxy: client <-> PyIDE server <-> user's PyKernel subprocess."""

import asyncio
import logging
from typing import Optional

import websockets
from fastapi import WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from .core.kernel_manager import kernel_manager
from .core.security import validate_ws_token
from .db.session import SessionLocal

logger = logging.getLogger(__name__)

CLOSE_POLICY_VIOLATION = 1008  # RFC 6455 – used for auth failures


async def _forward(src, dst, label: str) -> None:
    """Relay messages from *src* to *dst* until either end closes."""
    try:
        async for message in src:
            if isinstance(message, bytes):
                await dst.send_bytes(message)
            else:
                await dst.send_text(message)
    except (WebSocketDisconnect, websockets.ConnectionClosed):
        pass
    except Exception as exc:  # noqa: BLE001
        logger.debug("Forward (%s) stopped: %s", label, exc)


async def kernel_websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    """Full bidirectional WebSocket proxy.

    Clients connect to  ws://<server>/ws/kernel?token=<JWT>
    The server authenticates the token, starts (or reuses) the user's
    PyKernel subprocess, and forwards messages in both directions.
    """
    client_host = websocket.client.host if websocket.client else "unknown"
    if not token:
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    db: Session = SessionLocal()
    try:
        # --- Authenticate before accepting --------------------------------
        try:
            user = await validate_ws_token(token, db)
        except Exception as auth_exc:
            logger.warning(
                "WebSocket auth failed from %s: %s", client_host, auth_exc
            )
            await websocket.close(code=CLOSE_POLICY_VIOLATION)
            return

        await websocket.accept()
        logger.info("WebSocket accepted for user %s from %s", user.username, client_host)

        # --- Get or create the kernel -------------------------------------
        try:
            kernel_proc = await kernel_manager.get_or_create_kernel(
                user_id=user.id,
                username=user.username,
            )
        except Exception as exc:
            logger.error("Failed to start kernel for user %s: %s", user.username, exc)
            await websocket.send_text(
                f'{{"type":"error","message":"Could not start kernel: {exc}"}}'
            )
            await websocket.close(code=1011)
            return

        logger.info(
            "WebSocket proxy opened for user %s -> kernel port %s",
            user.username, kernel_proc.port,
        )

        # --- Bidirectional proxy -----------------------------------------
        try:
            async with websockets.connect(
                kernel_proc.ws_url,
                open_timeout=5,
                ping_interval=20,
                ping_timeout=10,
            ) as kernel_ws:
                # Wrap kernel_ws so _forward can call .send_text / .send_bytes
                # websockets library uses .send() for both
                class _KernelAdapter:
                    """Thin adapter so both sides share the same _forward logic."""
                    def __aiter__(self_inner):
                        return self_inner

                    async def __anext__(self_inner):
                        try:
                            return await kernel_ws.recv()
                        except websockets.ConnectionClosed:
                            raise StopAsyncIteration

                    async def send_text(self_inner, data: str):
                        await kernel_ws.send(data)

                    async def send_bytes(self_inner, data: bytes):
                        await kernel_ws.send(data)

                async def client_to_kernel():
                    try:
                        while True:
                            data = await websocket.receive()
                            if "text" in data:
                                await kernel_ws.send(data["text"])
                            elif "bytes" in data:
                                await kernel_ws.send(data["bytes"])
                    except (WebSocketDisconnect, RuntimeError):
                        pass
                    except Exception as exc:  # noqa: BLE001
                        logger.debug("client→kernel stopped: %s", exc)

                async def kernel_to_client():
                    try:
                        async for message in kernel_ws:
                            if isinstance(message, bytes):
                                await websocket.send_bytes(message)
                            else:
                                await websocket.send_text(message)
                    except websockets.ConnectionClosed:
                        pass
                    except (WebSocketDisconnect, RuntimeError):
                        pass
                    except Exception as exc:  # noqa: BLE001
                        logger.debug("kernel→client stopped: %s", exc)

                # Run both directions concurrently; stop when either finishes
                done, pending = await asyncio.wait(
                    [
                        asyncio.create_task(client_to_kernel(), name="c2k"),
                        asyncio.create_task(kernel_to_client(), name="k2c"),
                    ],
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass

        except (websockets.ConnectionClosed, OSError) as exc:
            logger.warning(
                "Could not connect to kernel for user %s: %s", user.username, exc
            )
            try:
                await websocket.send_text(
                    f'{{"type":"error","message":"Kernel connection lost: {exc}"}}'
                )
            except Exception:
                pass
        except WebSocketDisconnect:
            pass
        finally:
            logger.info(
                "WebSocket proxy closed for user %s (kernel port %s)",
                user.username, kernel_proc.port,
            )
    finally:
        db.close()
