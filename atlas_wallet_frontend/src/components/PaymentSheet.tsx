import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Wallet, CreditCard, Calendar, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { atlasAddToCart, atlasCheckout } from "@/lib/atlasBackend";
import { insertDemoOrderTracking } from "@/lib/seedOrderTracking";

type Product = {
  product_id?: string;
  name: string;
  brand: string;
  price_mad: number;
  emoji: string;
  recommended_payment: "instant" | "bnpl" | "credit";
};

export default function PaymentSheet({
  product,
  walletBalance,
  onClose,
  onSuccess,
}: {
  product: Product | null;
  walletBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState<"instant" | "bnpl" | "credit">("instant");
  const [installments, setInstallments] = useState<3 | 4>(3);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { user } = useAuth();

  if (!product) return null;

  const canInstant = walletBalance >= product.price_mad;
  const perInstall = Math.round((product.price_mad / installments) * 100) / 100;
  const creditMonthly = Math.round((product.price_mad / 12) * 1.05 * 100) / 100;

  const checkout = async () => {
    setBusy(true);
    try {
      if (method === "instant" && product.product_id && user) {
        await atlasAddToCart(user.id, product.product_id, 1);
        const pay = await atlasCheckout(user.id);
        if (!pay.ok) throw new Error(pay.message);

        const { data: order, error: orderErr } = await supabase
          .from("orders")
          .insert({
            user_id: user.id,
            product_name: product.name,
            product_brand: product.brand ?? null,
            product_image: product.emoji ?? null,
            price_mad: product.price_mad,
            payment_method: "instant",
            status: "confirmed",
          })
          .select()
          .single();
        if (orderErr || !order) throw orderErr ?? new Error("Could not create order");
        await insertDemoOrderTracking(supabase, order.id, user.id);
      } else {
        const { data, error } = await supabase.functions.invoke("checkout", {
          body: { product, paymentMethod: method, installments: method === "bnpl" ? installments : undefined },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
      toast.success("Order confirmed! Tracking is live.");
      onSuccess();
      nav("/app/orders");
    } catch (e: any) {
      toast.error(e.message ?? "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const options = [
    {
      key: "instant" as const,
      icon: Wallet,
      title: "Pay now",
      sub: canInstant ? `Deduct ${product.price_mad.toLocaleString()} MAD from wallet` : "Insufficient balance",
      disabled: !canInstant,
      badge: "0% fees",
    },
    {
      key: "bnpl" as const,
      icon: Calendar,
      title: `Split in ${installments}`,
      sub: `${perInstall.toLocaleString()} MAD × ${installments} months`,
      disabled: false,
      badge: "0% interest",
    },
    {
      key: "credit" as const,
      icon: CreditCard,
      title: "Credit (12 months)",
      sub: `${creditMonthly.toLocaleString()} MAD/month · partner bank`,
      disabled: false,
      badge: "5% APR",
    },
  ];

  return (
    <Sheet open={!!product} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl">Choose how to pay</SheetTitle>
            <SheetDescription>Smart options based on your wallet.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary p-3">
            <div className="h-12 w-12 rounded-xl bg-primary-soft grid place-items-center text-2xl">{product.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">{product.brand}</div>
              <div className="font-semibold truncate">{product.name}</div>
            </div>
            <div className="font-display font-bold text-lg">
              {product.price_mad.toLocaleString()} <span className="text-xs text-muted-foreground">MAD</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {options.map((o) => (
            <button
              key={o.key}
              disabled={o.disabled}
              onClick={() => setMethod(o.key)}
              className={`w-full text-left rounded-2xl border p-4 transition-all flex items-center gap-3 ${
                method === o.key && !o.disabled
                  ? "border-primary bg-primary-soft shadow-soft"
                  : "bg-card hover:border-foreground/20"
              } ${o.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${
                method === o.key && !o.disabled ? "gradient-primary text-primary-foreground" : "bg-secondary"
              }`}>
                <o.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2">
                  {o.title}
                  <span className="text-[10px] font-medium text-primary bg-primary-soft px-1.5 py-0.5 rounded-full">
                    {o.badge}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{o.sub}</div>
              </div>
              {method === o.key && !o.disabled && (
                <div className="h-6 w-6 rounded-full gradient-primary text-primary-foreground grid place-items-center">
                  <Check className="h-3.5 w-3.5" />
                </div>
              )}
            </button>
          ))}

          {method === "bnpl" && (
            <div className="flex gap-2 pt-2">
              {[3, 4].map((n) => (
                <button
                  key={n}
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

          <Button
            onClick={checkout}
            disabled={busy || (method === "instant" && !canInstant)}
            className="w-full h-12 mt-4 gradient-primary text-primary-foreground hover:opacity-90 shadow-glow"
          >
            {busy ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
            ) : (
              `Confirm · ${product.price_mad.toLocaleString()} MAD`
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Demo mode — no real charge.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
