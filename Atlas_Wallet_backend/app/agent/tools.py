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
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
) -> str:
    """Search for partner products matching the user's criteria.

    Use this whenever the user is looking for a product, a deal, or wants to browse offers.
    Text matching uses **product name and tags only** — put style, type, or domain words in
    `query` (e.g. "smartphone", "running shoes"); do not rely on a separate category filter.

    **One product intent per call:** if the user asks for several different items in the same
    message (e.g. phone + headphones), call `search_products` **once per item** with a focused
    `query` each time. The UI shows **one card (best match) per successful call**, in order.

    Args:
        query: Free-text search over product names and tags (fuzzy / partial match).
        min_price: Minimum discounted price in MAD.
        max_price: Maximum discounted price in MAD.
        min_rating: Minimum rating (0-5).
    """
    from app.services.search_service import SearchService
    from app.services.context_service import ConversationContext

    conv_id = get_conv_id()
    results = SearchService.search(
        query=query,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        limit=1,
    )

    ConversationContext.set(conv_id, "last_search_results", results)

    primary = results["primary"]

    if not primary:
        return f"Aucun produit trouvé pour '{query}'. Essayez d'autres critères."

    p = primary[0]
    added, card_index = ConversationContext.append_search_best_product(conv_id, p)
    total = results["total_found"]
    lines = [
        f"**Meilleure option** pour « {query} » (sur {total} correspondance(s) ; **nom** et **tags** uniquement) :",
    ]

    def _one_product_block(idx: int, prod: dict) -> list[str]:
        saved = int(prod.get("price_mad", 0)) - int(prod.get("discounted_price_mad", 0))
        tags = prod.get("tags") or []
        tag_str = ", ".join(str(t) for t in tags) if tags else "—"
        desc = (prod.get("description") or "").strip()
        inv = prod.get("inventory")
        stock_bits = [prod.get("availability") or ""]
        if inv is not None:
            stock_bits.append(f"stock ~{inv}")
        rel = prod.get("relevance_score")
        head = (
            f"{idx}. **{prod['name']}** — partenaire **{prod['partner_name']}** — catégorie **{prod.get('partner_category', '')}** "
            f"— ID `{prod['id']}`"
        )
        if rel is not None:
            head += f" — pertinence {rel}/100"
        block = [
            head,
            f"   • Prix : ~~{prod['price_mad']}~~ → **{prod['discounted_price_mad']} MAD** "
            f"({prod.get('partner_discount', '')}, économie {saved} MAD)",
            f"   • Note : ⭐ {prod.get('rating', 'N/A')} | {' | '.join(b for b in stock_bits if b)}",
            f"   • Tags : {tag_str}",
        ]
        if desc:
            block.append(f"   • Description : {desc}")
        return block

    lines.extend(_one_product_block(1, p))

    if added:
        lines.append(
            f"\n\n_(Carte **n°{card_index}** dans la rangée sous ta réponse — une carte par recherche / "
            "produit visé ; ne recopie pas les détails dans le message utilisateur.)_"
        )
    else:
        lines.append(
            "\n\n_(Ce produit était déjà dans la rangée de cartes pour ce tour — pas de doublon.)_"
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