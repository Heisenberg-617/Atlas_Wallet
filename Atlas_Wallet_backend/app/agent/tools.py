"""LangGraph agent tools — the only interface the LLM has to search, cart, and wallet."""
from __future__ import annotations

import contextvars
from typing import Optional

from langchain_core.tools import tool

# Per-request conversation id injected by the route handler
_current_conv_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_conv_id", default="default"
)


def set_conv_id(conv_id: str) -> None:
    _current_conv_id.set(conv_id)


def get_conv_id() -> str:
    return _current_conv_id.get()


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@tool
def search_products(
    query: str,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
) -> str:
    """Search for partner products matching the user's criteria.

    Use this whenever the user is looking for a product, a deal, wants to browse
    offers, or mentions a category / brand / price range.

    Args:
        query: Free-text search (product name, brand, keyword).
        category: Partner category filter (e.g. "Restauration", "Mode", "Sport").
        min_price: Minimum discounted price in MAD.
        max_price: Maximum discounted price in MAD.
        min_rating: Minimum rating (0-5).
    """
    from app.services.search_service import SearchService
    from app.services.context_service import ConversationContext

    conv_id = get_conv_id()
    results = SearchService.search(
        query=query,
        category=category,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
    )

    # Store raw results so the API layer can build cards
    ConversationContext.set(conv_id, "last_search_results", results)

    primary = results["primary"]
    alternatives = results["alternatives"]

    if not primary:
        return f"Aucun produit trouvé pour '{query}'. Essayez d'autres critères."

    lines = [f"Trouvé {results['total_found']} produit(s). Voici les {len(primary)} meilleurs résultats :"]
    for i, p in enumerate(primary, 1):
        saved = p["price_mad"] - p["discounted_price_mad"]
        lines.append(
            f"{i}. **{p['name']}** ({p['partner_name']}) — "
            f"~~{p['price_mad']}~~ → **{p['discounted_price_mad']} MAD** "
            f"({p.get('partner_discount', '')} / -{saved} MAD) | "
            f"⭐ {p.get('rating', 'N/A')} | ID: {p['id']}"
        )

    if alternatives:
        lines.append(f"\n**Alternatives ({len(alternatives)}) :**")
        for i, p in enumerate(alternatives, 1):
            lines.append(
                f"  {i}. {p['name']} ({p['partner_name']}) — "
                f"{p['discounted_price_mad']} MAD | ID: {p['id']}"
            )

    lines.append(
        "\n\n_(Rappel : l’interface affiche ces articles en cartes sous ta réponse — "
        "ne recopie pas cette liste dans le message utilisateur.)_"
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Cart
# ---------------------------------------------------------------------------

@tool
def add_to_cart(product_id: str, quantity: int = 1) -> str:
    """Add a product to the shopping cart by its product ID.

    Args:
        product_id: The unique product identifier (e.g. 'BK-001').
        quantity: Number of units to add (default 1).
    """
    from app.services.search_service import SearchService
    from app.services.cart_service import CartService

    conv_id = get_conv_id()
    product = SearchService.get_product_by_id(product_id)

    if not product:
        return f"Produit avec l'ID '{product_id}' introuvable."

    if product.get("availability") == "Rupture de stock":
        return f"Désolé, '{product['name']}' est actuellement en rupture de stock."

    CartService.add_item(conv_id, product, quantity)
    summary = CartService.get_summary(conv_id)

    return (
        f"Ajouté {quantity}x **{product['name']}** au panier.\n"
        f"Panier : {summary['item_count']} article(s), "
        f"total : **{summary['total_discounted']} MAD** "
        f"(vous économisez {summary['total_savings']} MAD)."
    )


@tool
def remove_from_cart(product_id: str) -> str:
    """Remove a product from the shopping cart by its ID.

    Args:
        product_id: The product identifier to remove.
    """
    from app.services.cart_service import CartService

    conv_id = get_conv_id()
    CartService.remove_item(conv_id, product_id)
    summary = CartService.get_summary(conv_id)

    return (
        f"Article retiré du panier.\n"
        f"Panier : {summary['item_count']} article(s), "
        f"total : {summary['total_discounted']} MAD."
    )


@tool
def view_cart() -> str:
    """View the current shopping cart — items, totals, and savings."""
    from app.services.cart_service import CartService

    conv_id = get_conv_id()
    summary = CartService.get_summary(conv_id)

    if not summary["items"]:
        return "Votre panier est vide."

    lines = [f"**Panier ({summary['item_count']} articles) :**"]
    for item in summary["items"]:
        lines.append(
            f"  • {item['quantity']}x {item['name']} ({item['partner']}) — "
            f"{item['discounted_price_mad']} MAD chacun"
        )
    lines.append(f"\nSous-total : {summary['total_original']} MAD")
    lines.append(f"Après remises : **{summary['total_discounted']} MAD**")
    lines.append(f"Vous économisez : **{summary['total_savings']} MAD** 🎉")

    return "\n".join(lines)


@tool
def clear_cart() -> str:
    """Remove all items from the shopping cart."""
    from app.services.cart_service import CartService

    conv_id = get_conv_id()
    CartService.clear(conv_id)
    return "Panier vidé."


# ---------------------------------------------------------------------------
# Wallet
# ---------------------------------------------------------------------------

@tool
def get_wallet_balance() -> str:
    """Check the user's current Atlas Wallet balance."""
    from app.services.wallet_service import WalletService

    balance = WalletService.get_balance()
    return f"Solde de votre portefeuille Atlas : **{balance:.2f} MAD**."


@tool
def checkout() -> str:
    """Confirm purchase of all cart items. Executes wallet-to-merchant transactions per partner.

    Call this ONLY when the user explicitly confirms they want to pay.
    """
    from app.services.cart_service import CartService
    from app.services.purchase_service import execute_checkout

    conv_id = get_conv_id()
    summary = CartService.get_summary(conv_id)

    if not summary["items"]:
        return "Votre panier est vide. Ajoutez des articles avant de payer."

    result = execute_checkout(conv_id)
    if result["ok"]:
        tx = result.get("transaction") or {}
        total = float(tx.get("total_paid", 0))
        savings = float(tx.get("total_saved", 0))
        new_bal = float(tx.get("new_balance", 0))
        tx_results = tx.get("results", [])
        tx_refs = ", ".join(
            f"{r['partner']} (ref: {r['reference']})" for r in tx_results
        )
        return (
            f"**Achat réussi !** 🎉\n\n"
            f"Montant payé : **{total:.2f} MAD**\n"
            f"Économies réalisées : **{savings:.2f} MAD**\n"
            f"Nouveau solde : **{new_bal:.2f} MAD**\n\n"
            f"Transactions : {tx_refs}"
        )

    failed = (result.get("transaction") or {}).get("results", [])
    failed = [r for r in failed if not r.get("success")]
    if failed:
        return (
            "Certaines transactions ont échoué : "
            + ", ".join(f"{r['partner']}: {r['message']}" for r in failed)
        )
    return result.get("message", "Paiement impossible.")


# ---------------------------------------------------------------------------
# Export list
# ---------------------------------------------------------------------------

ALL_TOOLS = [
    search_products,
    add_to_cart,
    remove_from_cart,
    view_cart,
    clear_cart,
    get_wallet_balance,
    checkout,
]