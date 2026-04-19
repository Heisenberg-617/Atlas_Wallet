"""In-memory per-conversation ephemeral context (last search results, last transaction, …)."""
from __future__ import annotations

from typing import Any


class ConversationContext:
    """Stores transient data per conversation_id that the API layer reads
    after the graph finishes a turn (e.g. raw search results for card rendering)."""

    _data: dict[str, dict[str, Any]] = {}

    @classmethod
    def get(cls, conv_id: str) -> dict[str, Any]:
        if conv_id not in cls._data:
            cls._data[conv_id] = {"last_search_results": {}, "last_transaction": None}
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