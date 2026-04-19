import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Loader2, Package, Wallet, CreditCard, Calendar, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  atlasCheckout,
  atlasClearCart,
  atlasGetCart,
  atlasRemoveCartItem,
  atlasWalletBalance,
  type AtlasCartSummary,
} from "@/lib/atlasBackend";
import { insertDemoOrderTracking } from "@/lib/seedOrderTracking";
import { useNavigate } from "react-router-dom";

type CartItem = {
  product_id: string;
  name: string;
  partner: string;
  price_mad: number;
  discounted_price_mad: number;
  discount: string;
  quantity: number;
};

type PayMethod = "instant" | "bnpl" | "credit";

export default function Cart() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [summary, setSummary] = useState<AtlasCartSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>("instant");
  const [installments, setInstallments] = useState<3 | 4>(3);
  const [atlasBalance, setAtlasBalance] = useState<number>(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [s, bal] = await Promise.all([
        atlasGetCart(user.id),
        atlasWalletBalance().catch(() => null),
      ]);
      setSummary(s);
      if (bal != null) setAtlasBalance(bal);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load cart");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = (summary?.items ?? []) as CartItem[];
  const total = summary ? Number(summary.total_discounted) : 0;
  const canInstantAtlas = atlasBalance >= total && total > 0;
  const perInstall = total > 0 ? Math.round((total / installments) * 100) / 100 : 0;
  const creditMonthly = total > 0 ? Math.round((total / 12) * 1.05 * 100) / 100 : 0;

  const removeLine = async (productId: string) => {
    if (!user) return;
    setRemovingId(productId);
    try {
      const s = await atlasRemoveCartItem(user.id, productId);
      setSummary(s);
      toast.success("Item removed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setRemovingId(null);
    }
  };

  const submitPayment = async () => {
    if (!user || !summary?.item_count || total <= 0) return;
    const snapshot = summary;
    const lines = snapshot.items as CartItem[];

    setBusy(true);
    try {
      if (method === "instant") {
        const pay = await atlasCheckout(user.id);
        if (!pay.ok) {
          toast.error(pay.message || "Checkout failed");
          return;
        }
        toast.success("Paid from Atlas Wallet!");

        for (const item of lines) {
          const lineTotal = Number(item.discounted_price_mad) * Number(item.quantity);
          const label = item.quantity > 1 ? `${item.name} (×${item.quantity})` : item.name;
          const { data: order, error: orderErr } = await supabase
            .from("orders")
            .insert({
              user_id: user.id,
              product_name: label,
              product_brand: item.partner ?? null,
              product_image: "🛍️",
              price_mad: lineTotal,
              payment_method: "instant",
              status: "confirmed",
            })
            .select()
            .single();
          if (!orderErr && order) {
            await insertDemoOrderTracking(supabase, order.id, user.id).catch(() => {});
          }
        }

        setSummary(pay.cart);
        void atlasWalletBalance()
          .then(setAtlasBalance)
          .catch(() => {});
        nav("/app/orders");
        return;
      }

      // BNPL or credit: one Supabase order for the whole cart, then clear Atlas cart
      const title =
        lines.length === 1
          ? lines[0].quantity > 1
            ? `${lines[0].name} (×${lines[0].quantity})`
            : lines[0].name
          : `Cart — ${lines.length} items`;
      const brand =
        lines
          .map((i) => `${i.partner}: ${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`)
          .join(" · ")
          .slice(0, 500) || "Atlas partners";

      const { data, error } = await supabase.functions.invoke("checkout", {
        body: {
          product: {
            name: title,
            brand,
            price_mad: total,
            emoji: "🛍️",
            recommended_payment: method,
          },
          paymentMethod: method,
          installments: method === "bnpl" ? installments : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await atlasClearCart(user.id);
      const cleared = await atlasGetCart(user.id);
      setSummary(cleared);
      void atlasWalletBalance()
        .then(setAtlasBalance)
        .catch(() => {});

      toast.success(method === "bnpl" ? "BNPL order confirmed!" : "Credit order confirmed!");
      nav("/app/orders");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const payOptions: {
    key: PayMethod;
    icon: typeof Wallet;
    title: string;
    sub: string;
    disabled: boolean;
    badge: string;
  }[] = [
    {
      key: "instant",
      icon: Wallet,
      title: "Pay now",
      sub: canInstantAtlas
        ? `Charge ${total.toLocaleString()} MAD from Atlas Wallet`
        : "Insufficient Atlas Wallet balance",
      disabled: !canInstantAtlas,
      badge: "0% fees",
    },
    {
      key: "bnpl",
      icon: Calendar,
      title: `Split (BNPL)`,
      sub: `${perInstall.toLocaleString()} MAD × ${installments} months`,
      disabled: false,
      badge: "0% interest",
    },
    {
      key: "credit",
      icon: CreditCard,
      title: "Credit (12 months)",
      sub: `${creditMonthly.toLocaleString()} MAD/month · partner bank`,
      disabled: false,
      badge: "5% APR",
    },
  ];

  const confirmLabel =
    method === "instant"
      ? `Confirm · ${total.toLocaleString()} MAD`
      : method === "bnpl"
        ? `Confirm BNPL · ${total.toLocaleString()} MAD`
        : `Confirm credit · ${total.toLocaleString()} MAD`;

  if (!user) return null;

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl gradient-primary text-primary-foreground grid place-items-center shadow-glow">
          <ShoppingCart className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Cart</h1>
          <p className="text-sm text-muted-foreground">Review items, choose payment, then confirm.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center space-y-3">
          <Package className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Button variant="outline" className="rounded-xl" onClick={() => nav("/app")}>
            Browse in Chat
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => {
              const line = Number(item.discounted_price_mad) * Number(item.quantity);
              const removing = removingId === item.product_id;
              return (
                <li
                  key={item.product_id}
                  className="rounded-2xl border bg-card p-4 flex gap-3 items-start"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary-soft grid place-items-center text-lg shrink-0">
                    🛍️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold leading-tight">{item.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.partner}</div>
                    <div className="text-sm mt-2">
                      <span className="font-display font-bold">{line.toLocaleString()} MAD</span>
                      {item.quantity > 1 && (
                        <span className="text-muted-foreground text-xs ml-2">
                          {item.quantity} × {Number(item.discounted_price_mad).toLocaleString()} MAD
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={removing}
                    onClick={() => void removeLine(item.product_id)}
                    aria-label="Remove from cart"
                  >
                    {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </li>
              );
            })}
          </ul>

          <div className="rounded-2xl border bg-secondary/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="line-through">{Number(summary!.total_original).toLocaleString()} MAD</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>Total after partner discounts</span>
              <span className="font-display">{total.toLocaleString()} MAD</span>
            </div>
            {summary!.total_savings > 0 && (
              <div className="flex justify-between text-primary text-xs font-medium">
                <span>You save</span>
                <span>{Number(summary!.total_savings).toLocaleString()} MAD</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground pt-1 border-t border-border/60 mt-2">
              Atlas Wallet (mock) balance: <span className="font-medium text-foreground">{atlasBalance.toLocaleString()} MAD</span>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Choose how to pay
            </h2>
            <div className="space-y-3">
              {payOptions.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => setMethod(o.key)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all flex items-center gap-3 ${
                    method === o.key && !o.disabled
                      ? "border-primary bg-primary-soft shadow-soft"
                      : "bg-card hover:border-foreground/20"
                  } ${o.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${
                      method === o.key && !o.disabled
                        ? "gradient-primary text-primary-foreground"
                        : "bg-secondary"
                    }`}
                  >
                    <o.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      {o.title}
                      <span className="text-[10px] font-medium text-primary bg-primary-soft px-1.5 py-0.5 rounded-full">
                        {o.badge}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{o.sub}</div>
                  </div>
                  {method === o.key && !o.disabled && (
                    <div className="h-6 w-6 rounded-full gradient-primary text-primary-foreground grid place-items-center shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {method === "bnpl" && (
              <div className="flex gap-2 pt-3">
                {[3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setInstallments(n as 3 | 4)}
                    className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                      installments === n ? "border-primary bg-primary-soft text-primary" : ""
                    }`}
                  >
                    {n} payments
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground hover:opacity-90 shadow-glow"
            disabled={busy || (method === "instant" && !canInstantAtlas)}
            onClick={() => void submitPayment()}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Pay now uses the Atlas mock wallet. BNPL / credit use the demo Supabase checkout (in-app wallet).
          </p>
        </>
      )}
    </div>
  );
}
