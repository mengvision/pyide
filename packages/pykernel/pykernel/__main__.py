"""Entry point for PyKernel.

Run with: python -m pykernel --port 8765 --host 127.0.0.1
"""

import argparse
import asyncio
import logging
import signal
import sys

from .ws_server import WebSocketServer


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="PyKernel - Custom Python kernel for PyIDE",
        prog="python -m pykernel",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8765,
        help="WebSocket server port (default: 8765)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="WebSocket server host (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Logging level (default: INFO)",
    )
    return parser.parse_args()


def setup_logging(level: str) -> None:
    """Configure logging."""
    logging.basicConfig(
        level=getattr(logging, level),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


async def run_server(host: str, port: int) -> None:
    """Run the WebSocket server until cancelled."""
    server = WebSocketServer(host=host, port=port)
    await server.start()
    print(f"PyKernel started on ws://{host}:{port}", flush=True)

    stop_event = asyncio.Event()

    # Windows: handle SIGINT via signal.signal (no add_signal_handler support)
    def _handle_sigint(signum, frame):
        logging.getLogger(__name__).info("Received SIGINT, shutting down...")
        asyncio.get_event_loop().call_soon_threadsafe(stop_event.set)

    signal.signal(signal.SIGINT, _handle_sigint)

    # On non-Windows platforms also handle SIGTERM via asyncio
    if sys.platform != "win32":
        loop = asyncio.get_running_loop()
        loop.add_signal_handler(signal.SIGTERM, stop_event.set)

    try:
        await stop_event.wait()
    finally:
        logging.getLogger(__name__).info("Stopping PyKernel server...")
        await server.stop()
        logging.getLogger(__name__).info("PyKernel server stopped.")


def main() -> None:
    """Main entry point."""
    args = parse_args()
    setup_logging(args.log_level)

    try:
        asyncio.run(run_server(args.host, args.port))
    except KeyboardInterrupt:
        pass
    finally:
        print("PyKernel exited.", flush=True)


if __name__ == "__main__":
    main()
