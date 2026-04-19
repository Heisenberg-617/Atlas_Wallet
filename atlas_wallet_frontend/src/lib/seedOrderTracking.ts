import type { SupabaseClient } from "@supabase/supabase-js";

const TRACKING_STAGES = [
  { status: "confirmed", message: "Order confirmed. Merchant notified.", offsetSec: 0 },
  { status: "shipped", message: "Package handed to courier.", offsetSec: 20 },
  { status: "out_for_delivery", message: "Out for delivery in your area.", offsetSec: 45 },
  { status: "delivered", message: "Delivered. Enjoy your purchase!", offsetSec: 75 },
] as const;

export async function insertDemoOrderTracking(
  supabase: SupabaseClient,
  orderId: string,
  userId: string,
): Promise<void> {
  const now = Date.now();
  const rows = TRACKING_STAGES.map((stage) => ({
    order_id: orderId,
    user_id: userId,
    status: stage.status,
    message: stage.message,
    occurs_at: new Date(now + stage.offsetSec * 1000).toISOString(),
  }));

  const { error } = await supabase.from("order_events").insert(rows);
  if (error) {
    throw new Error(error.message || "Could not create demo tracking events");
  }
}
