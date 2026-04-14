from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://pyide_user:pyide_password@localhost:5432/pyide_db"
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS — Tauri dev server + optional production origins
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:1420",
        "tauri://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*",  # Allow any LAN IP
    ]

    REDIS_URL: str = "redis://localhost:6379/0"

    # Kernel subprocess port allocation
    KERNEL_PORT_START: int = 9000
    KERNEL_PORT_END: int = 9999

    # Directory under which per-user workspaces are created
    PYIDE_DATA_DIR: str = "/pyide-data"

    # ---------------------------------------------------------------------------
    # Rate limiting (in-memory, per auth endpoint)
    # ---------------------------------------------------------------------------
    RATE_LIMIT_MAX_REQUESTS: int = 5
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # ---------------------------------------------------------------------------
    # Request body size limit (bytes).  10 MB default.
    # ---------------------------------------------------------------------------
    MAX_REQUEST_SIZE: int = 10 * 1024 * 1024  # 10 MB


settings = Settings()
