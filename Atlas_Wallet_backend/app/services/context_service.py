"""In-memory per-conversation ephemeral context (last search results, last transaction, …)."""
from __future__ import annotations

from typing import Any

_KEY_BESTS = "search_bests_this_turn"


class ConversationContext:
    """Stores transient data per conversation_id that the API layer reads
    after the graph finishes a turn (e.g. raw search results for card rendering)."""

    _data: dict[str, dict[str, Any]] = {}

    @classmethod
    def get(cls, conv_id: str) -> dict[str, Any]:
        if conv_id not in cls._data:
            cls._data[conv_id] = {
                "last_search_results": {},
                "last_transaction": None,
                _KEY_BESTS: [],
            }
        cls._data[conv_id].setdefault(_KEY_BESTS, [])
        return cls._data[conv_id]

    @classmethod
    def set(cls, conv_id: str, key: str, value: Any) -> None:
        cls.get(conv_id)[key] = value

    @classmethod
    def get_value(cls, conv_id: str, key: str, default: Any = None) -> Any:
        return cls.get(conv_id).get(key, default)

    @classmethod
    def clear(cls, conv_id: str) -> None:
        cls._data.pop(conv_id, None)

    @classmethod
    def reset_search_bests_turn(cls, conv_id: str) -> None:
        """Clear accumulated best products before each new user message (one card stack per turn)."""
        cls.get(conv_id)[_KEY_BESTS] = []

    @classmethod
    def append_search_best_product(cls, conv_id: str, product: dict[str, Any]) -> tuple[bool, int]:
        """Append best match for one `search_products` call; skip duplicate product_id.

        Returns (added, one_based_index_in_row) — index is the position of this product in the card strip.
        """
        bucket: list[dict[str, Any]] = cls.get(conv_id)[_KEY_BESTS]
        pid = product.get("id")
        if pid and any(x.get("id") == pid for x in bucket):
            return False, len(bucket)
        bucket.append({**product})
        return True, len(bucket)