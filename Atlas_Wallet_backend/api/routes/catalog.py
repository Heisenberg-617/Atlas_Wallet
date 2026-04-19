"""Catalog endpoints — browse partners and products directly (no agent needed)."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Query

from app.services.search_service import SearchService

router = APIRouter()


@router.get("/products")
async def list_products(
    query: Optional[str] = Query(None, description="Text search (product name and tags only)"),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    min_rating: Optional[float] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """Search / list products with optional filters."""
    results = SearchService.search(
        query=query or "",
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        limit=limit,
    )
    return {
        "total_found": results["total_found"],
        "primary": results["primary"],
        "alternatives": results["alternatives"],
    }


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    """Get a single product by ID."""
    product = SearchService.get_product_by_id(product_id)
    if not product:
        return {"error": "Product not found", "product_id": product_id}, 404
    return product


@router.get("/partners")
async def list_partners():
    """List all partner merchants with product counts."""
    return {"partners": SearchService.list_partners()}