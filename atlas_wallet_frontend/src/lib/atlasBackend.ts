export type AtlasProductCard = {
  product_id: string;
  name: string;
  description?: string;
  price_mad: number;
  discounted_price_mad: number;
  discount?: string;
  partner: string;
  category?: string;
  rating?: number;
  availability?: string;
  is_primary?: boolean;
};

export type AtlasCartItem = {
  product_id: string;
  name: string;
  partner: string;
  price_mad: number;
  discounted_price_mad: number;
  discount: string;
  quantity: number;
};

export type AtlasCartSummary = {
  items: AtlasCartItem[];
  total_original: number;
  total_discounted: number;
  total_savings: number;
  item_count: number;
};

export type AtlasChatResponse = {
  conversation_id: string;
  response: string;
  type: "general" | "search_results" | "cart_update" | "checkout_result";
  cards: AtlasProductCard[];
  cart: AtlasCartSummary;
  transaction?: Record<string, unknown> | null;
};

export type AtlasCheckoutResponse = {
  ok: boolean;
  message: string;
  transaction?: Record<string, unknown> | null;
  cart: AtlasCartSummary;
};

const runtimeConfig = window.__ATLAS_RUNTIME_CONFIG__;

const RAW_API_BASE =
  runtimeConfig?.VITE_ATLAS_API_URL || import.meta.env.VITE_ATLAS_API_URL || (import.meta.env.DEV ? "/atlas-api" : "");
const API_BASE = RAW_API_BASE.endsWith("/") ? RAW_API_BASE.slice(0, -1) : RAW_API_BASE;

const DEFAULT_CONTRACT_ID =
  runtimeConfig?.VITE_ATLAS_CONTRACT_ID || import.meta.env.VITE_ATLAS_CONTRACT_ID || "LAN8267230088933305";

type ApiErrorBody = {
  detail?: string | { message?: string };
  message?: string;
  error?: string;
};

function toApiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function normalizeError(status: number, body: ApiErrorBody | null): string {
  if (!body) return `Atlas request failed (${status})`;
  if (typeof body.detail === "string") return body.detail;
  if (typeof body.detail === "object" && body.detail?.message) return body.detail.message;
  if (body.message) return body.message;
  if (body.error) return body.error;
  return `Atlas request failed (${status})`;
}

async function atlasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = await parseJson<T & ApiErrorBody>(response);
  if (!response.ok) {
    throw new Error(normalizeError(response.status, body));
  }

  return (body as T) ?? ({} as T);
}

function parseMadValue(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function atlasChat(conversationId: string, message: string): Promise<AtlasChatResponse> {
  return atlasFetch<AtlasChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      message,
    }),
  });
}

export async function atlasGetCart(conversationId: string): Promise<AtlasCartSummary> {
  return atlasFetch<AtlasCartSummary>(`/api/cart/${encodeURIComponent(conversationId)}`);
}

export async function atlasAddToCart(
  conversationId: string,
  productId: string,
  quantity = 1,
): Promise<AtlasCartSummary> {
  return atlasFetch<AtlasCartSummary>(`/api/cart/${encodeURIComponent(conversationId)}/items`, {
    method: "POST",
    body: JSON.stringify({ product_id: productId, quantity }),
  });
}

export async function atlasRemoveCartItem(
  conversationId: string,
  productId: string,
): Promise<AtlasCartSummary> {
  return atlasFetch<AtlasCartSummary>(
    `/api/cart/${encodeURIComponent(conversationId)}/items/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
  );
}

export async function atlasClearCart(conversationId: string): Promise<void> {
  await atlasFetch<{ status: string }>(`/api/cart/${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
  });
}

export async function atlasCheckout(conversationId: string): Promise<AtlasCheckoutResponse> {
  return atlasFetch<AtlasCheckoutResponse>(`/api/checkout/${encodeURIComponent(conversationId)}`, {
    method: "POST",
  });
}

type WalletBalanceResponse = {
  result?: {
    balance?: Array<{ value?: string | number }>;
  };
};

export async function atlasWalletBalance(contractId = DEFAULT_CONTRACT_ID): Promise<number> {
  const data = await atlasFetch<WalletBalanceResponse>(
    `/wallet/balance?contractid=${encodeURIComponent(contractId)}`,
  );
  const raw = data.result?.balance?.[0]?.value;
  return parseMadValue(raw);
}

type WalletSimulationResponse = {
  result?: {
    token?: string;
  };
};

export async function atlasCashInTopUp(
  amountMad: number,
  contractId = DEFAULT_CONTRACT_ID,
): Promise<void> {
  const simulation = await atlasFetch<WalletSimulationResponse>(
    `/wallet/cash/in?step=simulation`,
    {
      method: "POST",
      body: JSON.stringify({
        contractId,
        amount: amountMad,
      }),
    },
  );

  await atlasFetch(`/wallet/cash/in?step=confirmation`, {
    method: "POST",
    body: JSON.stringify({
      contractId,
      amount: amountMad,
      token: simulation.result?.token ?? "",
    }),
  });
}
