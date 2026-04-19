// Updates an order's status based on the latest order_event whose occurs_at <= now.
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
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: orders } = await admin.from("orders").select("id,status").eq("user_id", userData.user.id);
    if (!orders) return new Response(JSON.stringify({ updated: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let updated = 0;
    for (const o of orders) {
      const { data: ev } = await admin
        .from("order_events")
        .select("status")
        .eq("order_id", o.id)
        .lte("occurs_at", new Date().toISOString())
        .order("occurs_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ev && ev.status !== o.status) {
        await admin.from("orders").update({ status: ev.status }).eq("id", o.id);
        updated++;
      }
    }
    return new Response(JSON.stringify({ updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
