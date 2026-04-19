"""In-memory shopping cart service keyed by conversation_id."""
from __future__ import annotations

from typing import Any


class CartService:
    _carts: dict[str, list[dict[str, Any]]] = {}

    @classmethod
    def get_cart(cls, conv_id: str) -> list[dict[str, Any]]:
        return list(cls._carts.get(conv_id, []))

    @classmethod
    def add_item(cls, conv_id: str, product: dict[str, Any], quantity: int = 1) -> None:
        if conv_id not in cls._carts:
            cls._carts[conv_id] = []

        for item in cls._carts[conv_id]:
            if item["product_id"] == product.get("id"):
                item["quantity"] += quantity
                return

        cls._carts[conv_id].append(
            {
                "product_id": product.get("id"),
                "name": product.get("name", ""),
                "partner": product.get("partner_name", ""),
                "price_mad": product.get("price_mad", 0),
                "discounted_price_mad": product.get("discounted_price_mad", 0),
                "discount": product.get("partner_discount", ""),
                "quantity": quantity,
            }
        )

    @classmethod
    def remove_item(cls, conv_id: str, product_id: str) -> None:
        if conv_id in cls._carts:
            cls._carts[conv_id] = [
                i for i in cls._carts[conv_id] if i["product_id"] != product_id
            ]

    @classmethod
    def clear(cls, conv_id: str) -> None:
        cls._carts.pop(conv_id, None)

    @classmethod
    def get_summary(cls, conv_id: str) -> dict[str, Any]:
        items = cls.get_cart(conv_id)
        total_original = sum(i["price_mad"] * i["quantity"] for i in items)
        total_discounted = sum(i["discounted_price_mad"] * i["quantity"] for i in items)
        return {
            "items": items,
            "total_original": total_original,
            "total_discounted": total_discounted,
            "total_savings": total_original - total_discounted,
            "item_count": sum(i["quantity"] for i in items),
        }