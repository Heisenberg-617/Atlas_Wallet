"""Atlas Wallet FastAPI application."""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from api.routes.agent import router as agent_router
from api.routes.catalog import router as catalog_router
from api.routes.wallet import router as wallet_router

app = FastAPI(
    title="Atlas Wallet API",
    description="Agentic layer between users and bank partner offers",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router, prefix="/api", tags=["Agent"])
app.include_router(catalog_router, prefix="/api/catalog", tags=["Catalog"])
app.include_router(wallet_router, tags=["Wallet"])


def _resolve_frontend_dist() -> Path | None:
    configured = os.getenv("FRONTEND_DIST")
    if configured:
        dist = Path(configured).expanduser().resolve()
    else:
        # Local fallback: repo_root/atlas_wallet_frontend/dist
        dist = (Path(__file__).resolve().parents[1] / "atlas_wallet_frontend" / "dist").resolve()

    if (dist / "index.html").exists():
        return dist
    return None


FRONTEND_DIST = _resolve_frontend_dist()
if FRONTEND_DIST and (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")


@app.get("/")
async def root():
    if FRONTEND_DIST:
        return FileResponse(FRONTEND_DIST / "index.html")
    return RedirectResponse(url="/docs")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "atlas-wallet-backend"}


@app.get("/api/reset")
async def reset_state():
    """Reset all in-memory state (cart, wallet balance, transactions)."""
    from app.services.cart_service import CartService
    from app.services.context_service import ConversationContext
    from mocks.wallet_mock import WalletMockState

    CartService._carts.clear()
    ConversationContext._data.clear()
    WalletMockState.reset()
    return {
        "status": "reset",
        "message": "All state cleared. Wallet balance reset to 5000 MAD.",
    }


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    """Serve the frontend SPA for non-API routes in production."""
    if not FRONTEND_DIST:
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    reserved_prefixes = ("api", "wallet", "docs", "redoc")
    if full_path in {"health", "openapi.json"} or full_path.startswith(reserved_prefixes):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    requested = (FRONTEND_DIST / full_path).resolve()
    if requested.is_file() and requested.is_relative_to(FRONTEND_DIST):
        return FileResponse(requested)

    return FileResponse(FRONTEND_DIST / "index.html")