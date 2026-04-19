import type { AtlasProductCard } from "@/lib/atlasBackend";

export type UiChatProduct = {
  product_id: string;
  name: string;
  brand: string;
  price_mad: number;
  emoji: string;
  rating: number;
  delivery_days: number;
  key_specs: string[];
  why: string;
  recommended_payment: "instant" | "bnpl" | "credit";
};

function pickEmoji(seed: string): string {
  const hay = seed.toLowerCase();
  if (hay.includes("phone") || hay.includes("smartphone")) return "📱";
  if (hay.includes("laptop") || hay.includes("notebook")) return "💻";
  if (hay.includes("headphone") || hay.includes("audio")) return "🎧";
  if (hay.includes("coffee")) return "☕";
  if (hay.includes("tv") || hay.includes("screen")) return "📺";
  return "🛍️";
}

function inferDeliveryDays(availability: string | undefined): number {
  if (!availability) return 3;
  const match = availability.match(/(\d+)/);
  if (match) return Number(match[1]);
  return 3;
}

function inferSpecs(description: string): string[] {
  if (!description.trim()) return [];
  return description
    .split(/[,.|;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function choosePayment(priceMad: number, walletBalanceMad: number): "instant" | "bnpl" | "credit" {
  if (walletBalanceMad >= priceMad) return "instant";
  if (priceMad <= 6000) return "bnpl";
  return "credit";
}

export function mapAtlasCardToUiProduct(card: AtlasProductCard, walletBalanceMad = 0): UiChatProduct {
  const effectivePrice = Number(card.discounted_price_mad || card.price_mad || 0);
  const description = card.description ?? "";
  const brand = card.partner || "Partner";

  return {
    product_id: card.product_id,
    name: card.name,
    brand,
    price_mad: effectivePrice,
    emoji: pickEmoji(`${card.name} ${description} ${card.category || ""}`),
    rating: Number(card.rating ?? 4.5),
    delivery_days: inferDeliveryDays(card.availability),
    key_specs: inferSpecs(description),
    why: card.discount
      ? `${brand} offer ${card.discount} with selected partner pricing.`
      : `Selected from ${brand} based on your request and value for money.`,
    recommended_payment: choosePayment(effectivePrice, walletBalanceMad),
  };
}
