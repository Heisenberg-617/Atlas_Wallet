"""Product search service — loads partner offers from JSON and provides flexible filtering."""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any, Optional

from rapidfuzz import fuzz

logger = logging.getLogger(__name__)

# Minimum fuzzy / partial match score (0–100) to keep a product when a text query is set.
_MIN_TEXT_SCORE = 68
_DEFAULT_LIMIT = 6

_DATA_PATH = Path(__file__).resolve().parent.parent.parent / "api" / "data" / "full_partner_offers.json"


def _tokenize_for_overlap(text: str) -> set[str]:
    """Lowercase alphanumeric tokens (handles accents poorly but matches ASCII tags like 5G)."""
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if len(t) >= 2}


def _collect_search_strings(product: dict[str, Any]) -> list[str]:
    """Text search surfaces: product name and tags only (no category, partner, or description)."""
    out: list[str] = []
    name = product.get("name")
    if isinstance(name, str) and name.strip():
        out.append(name.strip())
    tags: list[str] = []
    for t in product.get("tags") or []:
        if isinstance(t, str) and t.strip():
            s = t.strip()
            tags.append(s)
            out.append(s)
    if tags:
        out.append(" ".join(tags))
    return out


def _text_relevance(query: str, strings: list[str]) -> float:
    """0–100 relevance: substring matches win; otherwise best fuzzy score across all strings."""
    q = query.strip().lower()
    if not q:
        return 0.0
    q_tokens = _tokenize_for_overlap(q)
    best = 0.0
    for raw in strings:
        s = raw.strip()
        if not s:
            continue
        sl = s.lower()
        if q in sl:
            best = 100.0
            break
        # Query token overlaps a field token (e.g. "phone" inside "smartphone"; exact "5g" tag)
        stoks = _tokenize_for_overlap(s)
        if q_tokens and stoks:
            for wt in q_tokens:
                # Prefer query token inside field token ("phone" → "smartphone").
                # For tok in wt, require len(tok) >= 4 to avoid "al" matching inside "galxy".
                if len(wt) >= 3 and any(
                    (wt in tok) or (len(tok) >= 4 and tok in wt) for tok in stoks
                ):
                    best = max(best, 95.0)
                    break
                if len(wt) == 2 and wt in stoks:
                    best = max(best, 95.0)
                    break
        pr = float(fuzz.partial_ratio(q, sl))
        tsr = float(fuzz.token_set_ratio(q, sl))
        w = float(fuzz.WRatio(q, sl))
        best = max(best, pr, tsr, w)
    return best


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
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        min_rating: Optional[float] = None,
        limit: int = _DEFAULT_LIMIT,
    ) -> dict[str, Any]:
        cls._load()
        results = list(cls._products)

        # Price filter (on discounted price)
        if min_price is not None:
            results = [p for p in results if p.get("discounted_price_mad", 0) >= min_price]
        if max_price is not None:
            results = [p for p in results if p.get("discounted_price_mad", float("inf")) <= max_price]

        # Rating filter
        if min_rating is not None:
            results = [p for p in results if p.get("rating", 0) >= min_rating]

        # Text query: score using product name and tags only
        scored_rows: list[tuple[float, dict[str, Any]]] | None = None
        if query and query.strip():
            scored_rows = []
            for p in results:
                strings = _collect_search_strings(p)
                score = _text_relevance(query, strings)
                if score >= _MIN_TEXT_SCORE:
                    scored_rows.append((score, p))
            scored_rows.sort(
                key=lambda sp: (
                    sp[0],
                    sp[1].get("rating", 0),
                    sp[1].get("price_mad", 0) - sp[1].get("discounted_price_mad", 0),
                ),
                reverse=True,
            )
            results = [p for _, p in scored_rows]
        else:
            results.sort(
                key=lambda p: (
                    p.get("rating", 0),
                    p.get("price_mad", 0) - p.get("discounted_price_mad", 0),
                ),
                reverse=True,
            )

        # Annotate top slice with relevance (shallow copy — do not mutate cached products)
        if scored_rows is not None:
            primary = [
                {**p, "relevance_score": round(score, 1)} for score, p in scored_rows[:limit]
            ]
            alternatives = [
                {**p, "relevance_score": round(score, 1)}
                for score, p in scored_rows[limit : limit + 3]
            ]
        else:
            primary = [{**p} for p in results[:limit]]
            alternatives = [{**p} for p in results[limit : limit + 3]]

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