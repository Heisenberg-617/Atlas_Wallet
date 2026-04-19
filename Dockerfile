FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend

COPY atlas_wallet_frontend/package.json ./
RUN npm install

COPY atlas_wallet_frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY Atlas_Wallet_backend /app/Atlas_Wallet_backend

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir /app/Atlas_Wallet_backend

COPY --from=frontend-builder /build/frontend/dist /app/atlas_wallet_frontend_dist

ENV FRONTEND_DIST=/app/atlas_wallet_frontend_dist

EXPOSE 8000
WORKDIR /app/Atlas_Wallet_backend
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
