import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, TrendingDown, Calendar } from "lucide-react";
import { toast } from "sonner";
import { atlasCashInTopUp, atlasWalletBalance } from "@/lib/atlasBackend";

type Installment = {
  id: string;
  amount_mad: number;
  due_date: string;
  paid: boolean;
  installment_number: number;
  order_id: string;
};

export default function WalletPage() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [spent, setSpent] = useState(0);
  const [installments, setInstallments] = useState<Installment[]>([]);

  const load = async () => {
    if (!user) return;
    const [bal, { data: orders }, { data: inst }] = await Promise.all([
      atlasWalletBalance().catch(() => null),
      supabase.from("orders").select("price_mad").eq("user_id", user.id).eq("payment_method", "instant"),
      supabase.from("bnpl_installments").select("*").eq("user_id", user.id).order("due_date"),
    ]);
    if (bal != null) setBalance(bal);
    setSpent((orders ?? []).reduce((s: number, o: any) => s + Number(o.price_mad), 0));
    setInstallments((inst ?? []) as Installment[]);
  };

  useEffect(() => { load(); }, [user]);

  const topUp = async () => {
    if (!user) return;
    try {
      await atlasCashInTopUp(1000);
      toast.success("Wallet topped up with 1 000 MAD");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Top-up failed — is the Atlas backend running?");
    }
  };

  const totalUpcoming = installments.filter((i) => !i.paid).reduce((s, i) => s + Number(i.amount_mad), 0);

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Wallet</h1>
        <p className="text-muted-foreground">Your money, your installments.</p>
      </div>

      {/* Balance card */}
      <div className="rounded-3xl gradient-primary text-primary-foreground p-6 shadow-glow relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -right-20 top-20 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm text-white/80 mb-2">
            <Wallet className="h-4 w-4" /> Available balance
          </div>
          <div className="font-display text-5xl font-bold mb-1">{balance.toLocaleString()}</div>
          <div className="text-white/80 text-sm mb-6">MAD</div>
          <Button onClick={topUp} variant="secondary" size="sm" className="rounded-full">
            <Plus className="h-4 w-4 mr-1" /> Top up 1 000 MAD
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <TrendingDown className="h-3.5 w-3.5" /> Total spent
          </div>
          <div className="font-display text-2xl font-bold">{spent.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">MAD</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Calendar className="h-3.5 w-3.5" /> BNPL upcoming
          </div>
          <div className="font-display text-2xl font-bold">{totalUpcoming.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">MAD across {installments.filter((i) => !i.paid).length} payments</div>
        </div>
      </div>

      {/* Installments list */}
      <div>
        <h2 className="font-display text-xl font-bold mb-3">Active installments</h2>
        {installments.length === 0 && (
          <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No active installments. Use BNPL on a product to split a payment.
          </div>
        )}
        <div className="space-y-2">
          {installments.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <div className={`h-10 w-10 rounded-xl grid place-items-center ${i.paid ? "bg-success/10 text-success" : "bg-primary-soft text-primary"}`}>
                <Calendar className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Installment #{i.installment_number}</div>
                <div className="text-xs text-muted-foreground">Due {new Date(i.due_date).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{Number(i.amount_mad).toLocaleString()} MAD</div>
                <div className={`text-xs ${i.paid ? "text-success" : "text-muted-foreground"}`}>{i.paid ? "Paid" : "Scheduled"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
