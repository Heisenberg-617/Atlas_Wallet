"""Internal wallet service used by agent tools — wraps the mock wallet state."""
from __future__ import annotations

from typing import Any

from mocks.wallet_mock import WalletMockState


class WalletService:
    """Thin facade over WalletMockState for agent-tool consumption."""

    @classmethod
    def get_balance(cls) -> float:
        return WalletMockState.get_balance()

    @classmethod
    def wallet_to_merchant(
        cls, merchant_phone: str, amount: float, description: str = ""
    ) -> dict[str, Any]:
        """Execute the full Wallet-to-Merchant flow (simulate → OTP auto → confirm)."""
        balance = WalletMockState.get_balance()

        # --- Simulation ---
        reference_id = WalletMockState.next_reference_id()
        sim = {
            "amount": str(amount),
            "referenceId": reference_id,
            "beneficiaryFirstName": "Merchant",
            "beneficiaryLastName": merchant_phone[-4:],
            "totalAmount": str(amount),
            "totalFrai": "0",
            "type": "TM",
            "status": "simulated",
        }

        # --- OTP (auto for POC) ---
        _otp = "123456"

        # --- Confirmation ---
        if balance < amount:
            return {
                "success": False,
                "message": "Solde insuffisant",
                "simulation": sim,
            }

        WalletMockState.debit(amount)
        tx_ref = WalletMockState.next_reference_id()
        tx = {
            "amount": str(amount),
            "currency": "MAD",
            "date": WalletMockState.now_str(),
            "type": "TM",
            "srcDestNumber": merchant_phone,
            "referenceId": tx_ref,
            "status": "000",
            "clientNote": description,
        }
        WalletMockState.add_transaction(tx)

        return {
            "success": True,
            "transaction_reference": tx_ref,
            "simulation_reference": reference_id,
            "new_balance": WalletMockState.get_balance(),
            "message": "Transaction réussie",
        }