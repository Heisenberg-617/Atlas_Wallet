import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package, Check, Truck, Home, Clock } from "lucide-react";

type Order = {
  id: string;
  product_name: string;
  product_brand: string | null;
  product_image: string | null;
  price_mad: number;
  payment_method: string;
  status: string;
  created_at: string;
};

type Event = { id: string; status: string; message: string | null; occurs_at: string };

const STAGES = [
  { key: "confirmed", label: "Confirmed", icon: Check },
  { key: "shipped", label: "Shipped", icon: Package },
  { key: "out_for_delivery", label: "Out for delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Home },
];

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Record<string, Event[]>>({});

  const load = async () => {
    if (!user) return;
    // Advance any orders whose simulated time has passed
    await supabase.functions.invoke("advance-tracking").catch(() => {});
    const { data: os } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setOrders((os ?? []) as Order[]);
    if (os && os.length) {
      const { data: evs } = await supabase
        .from("order_events")
        .select("*")
        .in("order_id", os.map((o: any) => o.id))
        .order("occurs_at");
      const grouped: Record<string, Event[]> = {};
      (evs ?? []).forEach((e: any) => {
        (grouped[e.order_id] ||= []).push(e);
      });
      setEvents(grouped);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [user]);

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Orders</h1>
        <p className="text-muted-foreground">Live tracking, in chat.</p>
      </div>

      {orders.length === 0 && (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No orders yet. Ask Atlas to find something.</p>
        </div>
      )}

      <div className="space-y-4">
        {orders.map((o) => {
          const stageIdx = STAGES.findIndex((s) => s.key === o.status);
          const orderEvents = events[o.id] ?? [];
          return (
            <div key={o.id} className="rounded-3xl border bg-card overflow-hidden shadow-soft">
              <div className="flex items-center gap-3 p-4 border-b">
                <div className="h-12 w-12 rounded-xl bg-primary-soft grid place-items-center text-2xl">
                  {o.product_image || "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{o.product_brand}</div>
                  <div className="font-semibold truncate">{o.product_name}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold">{Number(o.price_mad).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">{o.payment_method}</div>
                </div>
              </div>

              {/* Progress */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  {STAGES.map((s, i) => {
                    const reached = i <= stageIdx;
                    const Icon = s.icon;
                    return (
                      <div key={s.key} className="flex flex-col items-center gap-1 flex-1">
                        <div
                          className={`h-9 w-9 rounded-full grid place-items-center transition-all ${
                            reached ? "gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"
                          } ${i === stageIdx && stageIdx < 3 ? "animate-pulse-dot" : ""}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className={`text-[10px] text-center font-medium ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                          {s.label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Event timeline */}
                <div className="space-y-2 pt-3 border-t">
                  {orderEvents
                    .filter((e) => new Date(e.occurs_at) <= new Date())
                    .slice()
                    .reverse()
                    .map((e) => (
                      <div key={e.id} className="flex gap-2 text-xs">
                        <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <span className="text-foreground">{e.message}</span>
                          <span className="text-muted-foreground ml-2">{new Date(e.occurs_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
