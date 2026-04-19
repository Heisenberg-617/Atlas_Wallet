"""Agent chat endpoints — the main interface for the frontend."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel, Field

from app.agent.graph import graph
from app.agent.tools import set_conv_id
from app.services.cart_service import CartService
from app.services.context_service import ConversationContext
from app.services.purchase_service import add_product_to_cart, execute_checkout

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    conversation_id: str = Field(..., description="Unique ID for the conversation session")
    message: str = Field(..., min_length=1, description="User message")


class AddCartItemBody(BaseModel):
    product_id: str = Field(..., min_length=1)
    quantity: int = Field(1, ge=1, le=99)


class ProductCard(BaseModel):
    product_id: str
    name: str
    description: str = ""
    price_mad: float
    discounted_price_mad: float
    discount: str = ""
    partner: str
    category: str = ""
    rating: Optional[float] = None
    availability: str = ""
    is_primary: bool = True


class CartSummary(BaseModel):
    items: list[dict[str, Any]]
    total_original: float
    total_discounted: float
    total_savings: float
    item_count: int


class ChatResponse(BaseModel):
    conversation_id: str
    response: str
    type: str = "general"  # general | search_results | cart_update | checkout_result
    cards: list[ProductCard] = []
    cart: CartSummary
    transaction: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_cards(raw_results: dict[str, Any]) -> list[ProductCard]:
    cards: list[ProductCard] = []
    for p in raw_results.get("primary", []):
        cards.append(
            ProductCard(
                product_id=p.get("id", ""),
                name=p.get("name", ""),
                description=p.get("description", ""),
                price_mad=p.get("price_mad", 0),
                discounted_price_mad=p.get("discounted_price_mad", 0),
                discount=p.get("partner_discount", ""),
                partner=p.get("partner_name", ""),
                category=p.get("partner_category", ""),
                rating=p.get("rating"),
                availability=p.get("availability", ""),
                is_primary=True,
            )
        )
    for p in raw_results.get("alternatives", []):
        cards.append(
            ProductCard(
                product_id=p.get("id", ""),
                name=p.get("name", ""),
                description=p.get("description", ""),
                price_mad=p.get("price_mad", 0),
                discounted_price_mad=p.get("discounted_price_mad", 0),
                discount=p.get("partner_discount", ""),
                partner=p.get("partner_name", ""),
                category=p.get("partner_category", ""),
                rating=p.get("rating"),
                availability=p.get("availability", ""),
                is_primary=False,
            )
        )
    return cards


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to the Atlas agent and get a structured response."""
    conv_id = request.conversation_id
    set_conv_id(conv_id)

    try:
        result = await graph.ainvoke(
            {"messages": [HumanMessage(content=request.message)]},
            config={"configurable": {"thread_id": conv_id}},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent error: {exc}") from exc

    # Extract last AI message
    response_text = ""
    for msg in reversed(result.get("messages", [])):
        if isinstance(msg, AIMessage):
            response_text = msg.content or ""
            break

    # Read ephemeral context set by tools during this turn
    search_results = ConversationContext.get_value(conv_id, "last_search_results", {})
    transaction = ConversationContext.get_value(conv_id, "last_transaction")
    cart_summary = CartService.get_summary(conv_id)

    # Determine response type
    response_type = "general"
    cards: list[ProductCard] = []

    if search_results and search_results.get("primary"):
        response_type = "search_results"
        cards = _build_cards(search_results)

    if transaction is not None:
        response_type = "checkout_result"

    # Check if response mentions cart operations (heuristic)
    cart_keywords = ["panier", "ajouté", "retiré", "ajout", "cart"]
    if response_type == "general" and any(kw in response_text.lower() for kw in cart_keywords):
        response_type = "cart_update"

    # Clear ephemeral data after reading
    ConversationContext.set(conv_id, "last_search_results", {})
    ConversationContext.set(conv_id, "last_transaction", None)

    return ChatResponse(
        conversation_id=conv_id,
        response=response_text,
        type=response_type,
        cards=cards,
        cart=CartSummary(**cart_summary),
        transaction=transaction,
    )


@router.get("/cart/{conversation_id}", response_model=CartSummary)
async def get_cart(conversation_id: str):
    """Retrieve the current cart for a conversation."""
    summary = CartService.get_summary(conversation_id)
    return CartSummary(**summary)


@router.delete("/cart/{conversation_id}")
async def delete_cart(conversation_id: str):
    """Clear the cart for a conversation."""
    CartService.clear(conversation_id)
    return {"conversation_id": conversation_id, "status": "cleared"}


class CheckoutHttpResponse(BaseModel):
    ok: bool
    message: str
    transaction: Optional[dict[str, Any]] = None
    cart: CartSummary


@router.post("/cart/{conversation_id}/items", response_model=CartSummary)
async def add_cart_item(conversation_id: str, body: AddCartItemBody):
    """Add a catalog product to the cart by product ID (for direct checkout from the UI)."""
    err = add_product_to_cart(conversation_id, body.product_id, body.quantity)
    if err:
        raise HTTPException(status_code=400, detail=err)
    summary = CartService.get_summary(conversation_id)
    return CartSummary(**summary)


@router.post("/checkout/{conversation_id}", response_model=CheckoutHttpResponse)
async def checkout_http(conversation_id: str):
    """Pay for the current cart using the mock Atlas wallet (wallet-to-merchant per partner)."""
    result = execute_checkout(conversation_id)
    summary = CartService.get_summary(conversation_id)
    return CheckoutHttpResponse(
        ok=bool(result["ok"]),
        message=str(result["message"]),
        transaction=result.get("transaction"),
        cart=CartSummary(**summary),
    )