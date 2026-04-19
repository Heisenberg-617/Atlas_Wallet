"""Direct purchase flow for HTTP APIs — mirrors agent `checkout` tool logic."""
from __future__ import annotations

from typing import Any, Optional

from app.services.cart_service import CartService
from app.services.context_service import ConversationContext
from app.services.wallet_service import WalletService


def execute_checkout(conv_id: str) -> dict[str, Any]:
    """
    Run wallet checkout for the current cart.

    Returns a dict with keys: ok (bool), message (str), transaction (optional dict for API layer).
    On success, clears the cart and sets ConversationContext last_transaction like the agent tool.
    """
    summary = CartService.get_summary(conv_id)

    if not summary["items"]:
        return {"ok": False, "message": "Votre panier est vide.", "transaction": None}

    total = float(summary["total_discounted"])
    balance = WalletService.get_balance()

    if balance < total:
        return {
            "ok": False,
            "message": (
                f"Solde insuffisant. Montant requis : {total:.2f} MAD, "
                f"solde disponible : {balance:.2f} MAD."
            ),
            "transaction": None,
        }

    partner_totals: dict[str, float] = {}
    for item in summary["items"]:
        partner = item["partner"]
        item_total = float(item["discounted_price_mad"]) * int(item["quantity"])
        partner_totals[partner] = partner_totals.get(partner, 0) + item_total

    tx_results = []
    for partner, amount in partner_totals.items():
        tx = WalletService.wallet_to_merchant(
            merchant_phone=f"+212 6{abs(hash(partner)) % 100_000_000:08d}",
            amount=amount,
            description=f"Achat chez {partner} via Atlas Wallet",
        )
        tx_results.append(
            {
                "partner": partner,
                "amount": amount,
                "success": tx["success"],
                "reference": tx.get("transaction_reference", ""),
                "message": tx.get("message", ""),
            }
        )

    all_ok = all(r["success"] for r in tx_results)

    if all_ok:
        CartService.clear(conv_id)
        tx_ctx: dict[str, Any] = {
            "success": True,
            "results": tx_results,
            "total_paid": total,
            "total_saved": float(summary["total_savings"]),
            "new_balance": WalletService.get_balance(),
        }
        ConversationContext.set(conv_id, "last_transaction", tx_ctx)
        refs = ", ".join(f"{r['partner']} (ref: {r['reference']})" for r in tx_results)
        return {
            "ok": True,
            "message": (
                f"Achat réussi. Montant payé : {total:.2f} MAD. "
                f"Nouveau solde : {WalletService.get_balance():.2f} MAD. Transactions : {refs}"
            ),
            "transaction": tx_ctx,
        }

    failed = [r for r in tx_results if not r["success"]]
    fail_ctx = {"success": False, "results": tx_results}
    ConversationContext.set(conv_id, "last_transaction", fail_ctx)
    return {
        "ok": False,
        "message": "Certaines transactions ont échoué : "
        + ", ".join(f"{r['partner']}: {r['message']}" for r in failed),
        "transaction": fail_ctx,
    }


def add_product_to_cart(conv_id: str, product_id: str, quantity: int = 1) -> Optional[str]:
    """Add a product by id to the cart. Returns error message or None on success."""
    from app.services.search_service import SearchService

    product = SearchService.get_product_by_id(product_id)
    if not product:
        return f"Produit '{product_id}' introuvable."
    if product.get("availability") == "Rupture de stock":
        return f"Produit '{product.get('name')}' en rupture de stock."
    CartService.add_item(conv_id, product, quantity)
    return None
