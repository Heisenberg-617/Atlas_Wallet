import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Star, Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PaymentSheet from "@/components/PaymentSheet";
import ChatAssistantMarkdown from "@/components/ChatAssistantMarkdown";
import { atlasChat, atlasWalletBalance } from "@/lib/atlasBackend";
import { mapAtlasCardToUiProduct, type UiChatProduct } from "@/lib/mapAtlasProduct";

type Product = UiChatProduct;

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; products?: Product[] };

const SUGGESTIONS = [
  "Phone under 3000 MAD",
  "Wireless headphones for the gym",
  "Laptop for design work",
  "Coffee machine for the office",
];

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history + wallet (balance from Atlas FastAPI mock wallet)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: msgs }, bal] = await Promise.all([
        supabase.from("chat_messages").select("*").eq("user_id", user.id).order("created_at"),
        atlasWalletBalance().catch(() => null),
      ]);
      if (bal != null) setWalletBalance(bal);
      if (msgs) {
        setMessages(
          msgs.map((m: any) => ({
            id: m.id,
            role: m.role,
            text: m.content,
            products: m.metadata?.products,
          }))
        );
      }
    })();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const ask = async (intent: string) => {
    if (!intent.trim() || busy || !user) return;
    setBusy(true);
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: intent };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    await supabase.from("chat_messages").insert({ user_id: user.id, role: "user", content: intent });

    try {
      const data = await atlasChat(user.id, intent);
      const text = data.response?.trim() || "Voici ce que j’ai trouvé.";
      const products: Product[] | undefined =
        data.cards?.length ? data.cards.map((c) => mapAtlasCardToUiProduct(c, walletBalance)) : undefined;
      const aMsg: Msg = { id: crypto.randomUUID(), role: "assistant", text, products };
      setMessages((m) => [...m, aMsg]);
      await supabase
        .from("chat_messages")
        .insert({ user_id: user.id, role: "assistant", content: text, metadata: products ? { products } : {} });
      const tx = data.transaction as { success?: boolean } | null | undefined;
      if (tx?.success) {
        void atlasWalletBalance()
          .then(setWalletBalance)
          .catch(() => {});
      }
    } catch (e: any) {
      toast.error(e.message ?? "AI request failed");
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", text: "Sorry — something went wrong. Try again." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-5rem)]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 animate-fade-in-up">
            <div className="inline-flex h-14 w-14 rounded-2xl gradient-primary text-primary-foreground items-center justify-center shadow-glow mb-4">
              <Sparkles className="h-7 w-7" />
            </div>
            <h1 className="font-display text-3xl font-bold mb-2">What do you want to buy?</h1>
            <p className="text-muted-foreground mb-8">Describe it. I'll find the 3 best options and the smartest way to pay.</p>
            <div className="grid sm:grid-cols-2 gap-2 max-w-lg mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="text-left rounded-2xl border bg-card p-4 hover:border-primary/40 hover:shadow-soft transition-all text-sm"
                >
                  <span className="text-primary font-medium">→</span> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className="animate-fade-in-up">
            {m.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-md gradient-primary text-primary-foreground px-4 py-2.5 text-sm shadow-soft">
                  {m.text}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2.5 items-start">
                  <div className="h-7 w-7 rounded-lg gradient-primary text-primary-foreground grid place-items-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-secondary px-4 py-2.5 text-sm">
                    <ChatAssistantMarkdown text={m.text} />
                  </div>
                </div>
                {m.products && (
                  <div className="pl-9 max-w-4xl">
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                      {m.products.map((p, i) => (
                        <ProductCard key={`${p.product_id}-${i}`} p={p} onSelect={() => setSelected(p)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex gap-2.5 items-start animate-fade-in-up">
            <div className="h-7 w-7 rounded-lg gradient-primary text-primary-foreground grid place-items-center shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-muted-foreground">Searching the market…</span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t bg-background/80 backdrop-blur-lg px-4 py-3 sticky bottom-16 lg:bottom-0">
        <form
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
          className="flex gap-2 max-w-3xl mx-auto"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what you need…"
            className="h-12 rounded-2xl bg-secondary border-transparent focus-visible:bg-background"
            disabled={busy}
          />
          <Button
            type="submit"
            disabled={busy || !input.trim()}
            className="h-12 w-12 rounded-2xl p-0 gradient-primary text-primary-foreground hover:opacity-90 shadow-glow"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>

      <PaymentSheet
        product={selected}
        onClose={() => setSelected(null)}
        onSuccess={() => setSelected(null)}
      />
    </div>
  );
}

function ProductCard({ p, onSelect }: { p: Product; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="group text-left rounded-2xl border bg-card p-4 hover:border-primary/50 hover:shadow-card transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="h-12 w-12 rounded-xl bg-primary-soft grid place-items-center text-2xl">{p.emoji}</div>
        <div className="text-xs font-semibold text-primary bg-primary-soft px-2 py-1 rounded-full">
          {p.recommended_payment === "instant" ? "Pay now" : p.recommended_payment === "bnpl" ? "Split x3" : "Credit"}
        </div>
      </div>
      <div className="space-y-1 mb-3">
        <div className="text-xs text-muted-foreground font-medium">{p.brand}</div>
        <div className="font-semibold leading-tight line-clamp-2">{p.name}</div>
      </div>
      <div className="font-display text-2xl font-bold mb-2">
        {p.price_mad.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">MAD</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3 fill-warning text-warning" />
          {p.rating.toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <Truck className="h-3 w-3" />
          {p.delivery_days}d
        </span>
      </div>
      <p className="text-xs text-muted-foreground italic line-clamp-2 mb-3">"{p.why}"</p>
      <div className="text-xs font-semibold text-primary group-hover:underline">Add to cart →</div>
    </button>
  );
}
