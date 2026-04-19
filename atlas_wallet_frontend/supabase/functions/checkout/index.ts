// Creates an order, debits wallet or schedules BNPL/credit installments,
// and seeds tracking events that auto-advance over short demo intervals.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { product, paymentMethod, installments } = await req.json();
    if (!product?.name || typeof product?.price_mad !== "number" || !["instant", "bnpl", "credit"].includes(paymentMethod)) {
      return new Response(JSON.stringify({ error: "invalid payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Wallet check for instant pay
    if (paymentMethod === "instant") {
      const { data: wallet } = await admin.from("wallets").select("balance_mad").eq("user_id", userId).single();
      if (!wallet || Number(wallet.balance_mad) < product.price_mad) {
        return new Response(JSON.stringify({ error: "Insufficient wallet balance. Choose BNPL or credit." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("wallets").update({ balance_mad: Number(wallet.balance_mad) - product.price_mad }).eq("user_id", userId);
    }

    // Create order
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        user_id: userId,
        product_name: product.name,
        product_brand: product.brand ?? null,
        product_image: product.emoji ?? null,
        price_mad: product.price_mad,
        payment_method: paymentMethod,
        status: "confirmed",
      })
      .select()
      .single();
    if (orderErr || !order) throw orderErr ?? new Error("order insert failed");

    // BNPL schedule
    if (paymentMethod === "bnpl") {
      const n = installments === 4 ? 4 : 3;
      const per = Math.round((product.price_mad / n) * 100) / 100;
      const rows = Array.from({ length: n }).map((_, i) => ({
        order_id: order.id,
        user_id: userId,
        installment_number: i + 1,
        amount_mad: per,
        due_date: new Date(Date.now() + i * 30 * 86400000).toISOString().slice(0, 10),
        paid: i === 0, // first installment paid today
      }));
      await admin.from("bnpl_installments").insert(rows);
      // Debit first installment from wallet if possible
      const { data: w } = await admin.from("wallets").select("balance_mad").eq("user_id", userId).single();
      if (w && Number(w.balance_mad) >= per) {
        await admin.from("wallets").update({ balance_mad: Number(w.balance_mad) - per }).eq("user_id", userId);
      }
    }

    // Seed tracking events with future occurs_at — UI can reveal them as time passes.
    const now = Date.now();
    const events = [
      { status: "confirmed", message: "Order confirmed. Merchant notified.", offsetSec: 0 },
      { status: "shipped", message: "Package handed to courier.", offsetSec: 20 },
      { status: "out_for_delivery", message: "Out for delivery in your area.", offsetSec: 45 },
      { status: "delivered", message: "Delivered. Enjoy your purchase!", offsetSec: 75 },
    ];
    await admin.from("order_events").insert(
      events.map((e) => ({
        order_id: order.id,
        user_id: userId,
        status: e.status,
        message: e.message,
        occurs_at: new Date(now + e.offsetSec * 1000).toISOString(),
      }))
    );

    return new Response(JSON.stringify({ order }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("checkout error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
