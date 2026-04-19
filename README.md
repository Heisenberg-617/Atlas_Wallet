# Atlas Wallet

Atlas Wallet is an agentic shopping wallet experience built as a full-stack monorepo. It combines a FastAPI backend powered by LangGraph, OpenAI, and partner offer orchestration with a React + Vite frontend built using shadcn/ui and Supabase integration.

## Running app:

https://atlaswallet-production.up.railway.app/

## Project Overview

- **Backend**: `Atlas_Wallet_backend`
  - FastAPI service
  - LangGraph-powered conversational agent
  - OpenAI integration for natural language shopping and decision making
  - Mock wallet endpoints for partner transactions and checkout flows

- **Frontend**: `atlas_wallet_frontend`
  - Vite + React application
  - shadcn/ui component library
  - Supabase integration for auth, functions, and state management
  - Wallet, catalog, cart, and chat interfaces

## Key Features

- Conversational shopping assistant via `/api/chat`
- Partner offer discovery and search
- Cart management and checkout simulation
- Wallet balance and wallet-to-merchant flow
- Deployment-ready monorepo structure for Railway and local development

## Folder Structure

- `Atlas_Wallet_backend/` - backend service
- `atlas_wallet_frontend/` - frontend web app
- `RAILWAY_DEPLOY.md` - deployment guidance for Railway

## Getting Started

### Backend

1. Open a terminal in `Atlas_Wallet_backend`
2. Install dependencies and activate the Python environment

```powershell
cd Atlas_Wallet_backend
# Use your environment manager, e.g. virtualenv, pipenv, or hatch
pip install -r requirements.txt
# or if using hatch
hatch env create
```

3. Set your OpenAI API key

```powershell
set OPENAI_API_KEY=sk-your-key
```

4. Run the backend

```powershell
python main.py
```

### Frontend

1. Open a terminal in `atlas_wallet_frontend`
2. Install dependencies

```powershell
cd atlas_wallet_frontend
npm install
```

3. Create a `.env` file from `.env.example` and provide values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ATLAS_API_URL` (optional)
- `VITE_ATLAS_CONTRACT_ID` (optional)

4. Start the frontend

```powershell
npm run dev
```

## Backend Endpoints

- `POST /api/chat` - main agent chat
- `GET /api/cart/{conv_id}` - view cart
- `DELETE /api/cart/{conv_id}` - clear cart
- `GET /api/catalog/products?query=&category=` - search products
- `GET /api/catalog/partners` - list partners
- `GET /wallet/balance?contractid=...` - wallet balance mock
- `POST /wallet/Transfer/WalletToMerchant?step=simulation` - simulate wallet payment
- `POST /wallet/Transfer/WalletToMerchant?step=confirmation` - confirm wallet payment
- `GET /api/reset` - reset application state for testing
- `POST /api/cart/{conversation_id}/items` - add product to cart
- `POST /api/checkout/{conversation_id}` - checkout cart via mock wallet

## Deployment

For monorepo deployment of the frontend and backend together, see the repository root `RAILWAY_DEPLOY.md`.

## Notes

- The backend requires Python 3.12+
- The frontend is a Vite React application with TypeScript and Tailwind CSS
- Many UI components are built using `shadcn/ui` primitives

## License

This repository includes project licensing in `LICENSE`.
