"""Product search service — loads partner offers from JSON and provides flexible filtering."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).resolve().parent.parent.parent / "api" / "data" / "full_partner_offers.json"


class SearchService:
    """Singleton-ish service that lazily loads products from the JSON file."""

    _products: list[dict[str, Any]] = []
    _loaded: bool = False

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------

    @classmethod
    def _load(cls) -> None:
        if cls._loaded:
            return
        cls._loaded = True  # prevent retry on failure
        try:
            with open(_DATA_PATH, "r", encoding="utf-8") as f:
                partners: list[dict[str, Any]] = json.load(f)
            for partner in partners:
                partner_name = partner.get("name", "")
                partner_category = partner.get("category", "")
                partner_discount = partner.get("discount", "")
                for product in partner.get("products", []):
                    product["partner_name"] = partner_name
                    product["partner_category"] = partner_category
                    product["partner_discount"] = partner_discount
                    cls._products.append(product)
            logger.info("Loaded %d products from %d partners", len(cls._products), len(partners))
        except FileNotFoundError:
            logger.warning("Partner offers file not found: %s — search will return empty results", _DATA_PATH)
        except json.JSONDecodeError as exc:
            logger.error("Invalid JSON in %s: %s", _DATA_PATH, exc)

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    @classmethod
    def search(
        cls,
        query: str = "",
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        min_rating: Optional[float] = None,
        limit: int = 5,
    ) -> dict[str, Any]:
        cls._load()
        results = list(cls._products)

        # Text filter
        if query:
            q = query.lower()
            results = [
                p
                for p in results
                if q in p.get("name", "").lower()
                or q in p.get("description", "").lower()
                or any(q in t.lower() for t in p.get("tags", []))
                or q in p.get("partner_name", "").lower()
            ]

        # Category filter
        if category:
            c = category.lower()
            results = [
                p
                for p in results
                if c in p.get("partner_category", "").lower()
                or c in p.get("partner_name", "").lower()
            ]

        # Price filter (on discounted price)
        if min_price is not None:
            results = [p for p in results if p.get("discounted_price_mad", 0) >= min_price]
        if max_price is not None:
            results = [p for p in results if p.get("discounted_price_mad", float("inf")) <= max_price]

        # Rating filter
        if min_rating is not None:
            results = [p for p in results if p.get("rating", 0) >= min_rating]

        # Sort: rating desc, then savings desc
        results.sort(
            key=lambda p: (
                p.get("rating", 0),
                p.get("price_mad", 0) - p.get("discounted_price_mad", 0),
            ),
            reverse=True,
        )

        primary = results[:limit]
        alternatives = results[limit : limit + 3]

        return {
            "primary": primary,
            "alternatives": alternatives,
            "total_found": len(results),
        }

    # ------------------------------------------------------------------
    # Get by ID
    # ------------------------------------------------------------------

    @classmethod
    def get_product_by_id(cls, product_id: str) -> Optional[dict[str, Any]]:
        cls._load()
        for p in cls._products:
            if p.get("id") == product_id:
                return p
        return None

    # ------------------------------------------------------------------
    # List all (for catalog API)
    # ------------------------------------------------------------------

    @classmethod
    def list_all_products(cls) -> list[dict[str, Any]]:
        cls._load()
        return list(cls._products)

    @classmethod
    def list_partners(cls) -> list[dict[str, Any]]:
        cls._load()
        seen: set[str] = set()
        partners: list[dict[str, Any]] = []
        for p in cls._products:
            name = p.get("partner_name", "")
            if name and name not in seen:
                seen.add(name)
                partners.append(
                    {
                        "name": name,
                        "category": p.get("partner_category", ""),
                        "discount": p.get("partner_discount", ""),
                        "product_count": sum(
                            1 for pp in cls._products if pp.get("partner_name") == name
                        ),
                    }
                )
        return partners