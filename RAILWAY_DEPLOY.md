# Atlas Wallet Railway Deployment

This repository is now packaged as one service:
- Backend: FastAPI
- Frontend: Vite build served by FastAPI

## What runs on Railway
- Docker image is built from the repository root `Dockerfile`.
- Frontend is built in a Node stage.
- Backend serves API routes and static frontend files from the same process.
- Railway exposes one public port through `PORT`.

## Required environment variables
Set these in Railway service variables:

- `OPENAI_API_KEY` (required for agent chat)
- `VITE_SUPABASE_URL` (required by frontend auth/data)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (required by frontend auth/data)
- `VITE_ATLAS_API_URL` (optional, defaults to same origin)
- `VITE_ATLAS_CONTRACT_ID` (optional, defaults to LAN8267230088933305)

## Deploy steps
1. Create a new Railway project.
2. Connect this GitHub repo.
3. Ensure the service root is repository root.
4. Railway detects `railway.toml` and uses Docker build.
5. Add the environment variables above.
6. Deploy.

## Local Docker run
Build and run from repo root:

```bash
docker build -t atlas-wallet .
docker run -p 8000:8000 \
  -e OPENAI_API_KEY=sk-... \
  -e VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  -e VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY \
  atlas-wallet
```

Then open `http://localhost:8000`.
