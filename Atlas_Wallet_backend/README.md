# Atlas Wallet Backend
Agentic shopping layer between users and bank partner offers, powered by LangGraph + GPT-4o-mini.


# How to run
```bash
cd Atlas_Wallet_backend
uv sync
set OPENAI_API_KEY=sk-your-key
python main.py
```

For full monorepo deployment on Railway (frontend + backend in one service), see `RAILWAY_DEPLOY.md` at repository root.


# Key endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Main agent chat |
| GET | `/api/cart/{conv_id}` | View cart |
| DELETE | `/api/cart/{conv_id}` | Clear cart |
| GET | `/api/catalog/products?query=&category=` | Direct product search |
| GET | `/api/catalog/partners` | List partners |
| GET | `/wallet/balance?contractid=...` | Wallet balance (mock) |
| POST | `/wallet/Transfer/WalletToMerchant?step=simulation` | W2M payment |
| POST | `/wallet/Transfer/WalletToMerchant?step=confirmation` | W2M confirm |
| GET | `/api/reset` | Reset all state (testing) |
| POST | `/api/cart/{conversation_id}/items` | Add product to cart (`{"product_id","quantity"}`) |
| POST | `/api/checkout/{conversation_id}` | Pay cart via mock wallet (W2M per partner) |