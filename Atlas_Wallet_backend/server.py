"""Atlas Wallet FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

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


@app.get("/")
async def root():
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