"""Atlas Wallet Backend - Entry point."""
import os

import uvicorn

if __name__ == "__main__":
    reload_enabled = os.getenv("UVICORN_RELOAD", "false").lower() == "true"
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        reload=reload_enabled,
        log_level="info",
    )