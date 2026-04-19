"""Mock wallet state — simulates the CIH Wallet Management Kit backend in memory."""
from __future__ import annotations

import random
import string
from datetime import datetime
from typing import Any


class WalletMockState:
    """Singleton mutable state that mirrors a real wallet backend."""

    _balance: float = 5000.00
    _contract_id: str = "LAN240478508299911"
    _phone_number: str = "212700446631"
    _transactions: list[dict[str, Any]] = []
    _ref_counter: int = 1_000_000_000

    # ------------------------------------------------------------------
    # Balance
    # ------------------------------------------------------------------

    @classmethod
    def get_balance(cls) -> float:
        return cls._balance

    @classmethod
    def debit(cls, amount: float) -> None:
        cls._balance = round(cls._balance - amount, 2)

    @classmethod
    def credit(cls, amount: float) -> None:
        cls._balance = round(cls._balance + amount, 2)

    # ------------------------------------------------------------------
    # Reference IDs
    # ------------------------------------------------------------------

    @classmethod
    def next_reference_id(cls) -> str:
        cls._ref_counter += 1
        return str(cls._ref_counter)

    @classmethod
    def random_token(cls, length: int = 32) -> str:
        return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))

    @classmethod
    def random_otp(cls) -> str:
        return "".join(random.choices(string.digits, k=6))

    @classmethod
    def now_str(cls) -> str:
        return datetime.now().strftime("%m/%d/%Y %I:%M:%S %p")

    # ------------------------------------------------------------------
    # Transactions
    # ------------------------------------------------------------------

    @classmethod
    def add_transaction(cls, tx: dict[str, Any]) -> None:
        cls._transactions.insert(0, tx)

    @classmethod
    def get_transactions(cls, limit: int = 20) -> list[dict[str, Any]]:
        return cls._transactions[:limit]

    # ------------------------------------------------------------------
    # Static info
    # ------------------------------------------------------------------

    @classmethod
    def contract_id(cls) -> str:
        return cls._contract_id

    @classmethod
    def phone_number(cls) -> str:
        return cls._phone_number

    # ------------------------------------------------------------------
    # Reset (for testing)
    # ------------------------------------------------------------------

    @classmethod
    def reset(cls) -> None:
        cls._balance = 5000.00
        cls._transactions.clear()
        cls._ref_counter = 1_000_000_000