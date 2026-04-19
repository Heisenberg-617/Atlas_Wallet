// Generates 3 AI-curated product options for a user's shopping intent.
// Uses tool-calling for structured output via Lovable AI Gateway.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { intent, walletBalance } = await req.json();
    if (!intent || typeof intent !== "string") {
      return new Response(JSON.stringify({ error: "intent required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const systemPrompt = `You are an expert AI shopping concierge for the Moroccan market. Given a user's intent, return EXACTLY 3 realistic, distinct product options sold in Morocco. Prices are in MAD (Moroccan Dirham). Be concise, accurate, and helpful. Wallet balance: ${walletBalance ?? "unknown"} MAD — if a product exceeds 50% of balance, recommend BNPL or credit; otherwise recommend instant pay.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: intent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_product_options",
              description: "Return 3 best product recommendations for the user's intent.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "One-sentence summary of what you found." },
                  products: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        brand: { type: "string" },
                        price_mad: { type: "number" },
                        rating: { type: "number", minimum: 0, maximum: 5 },
                        delivery_days: { type: "integer", minimum: 1, maximum: 14 },
                        key_specs: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                        why: { type: "string", description: "Why this is a top pick (one short sentence)." },
                        recommended_payment: { type: "string", enum: ["instant", "bnpl", "credit"] },
                        emoji: { type: "string", description: "Single emoji representing the product." },
                      },
                      required: ["name", "brand", "price_mad", "rating", "delivery_days", "key_specs", "why", "recommended_payment", "emoji"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "products"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_product_options" } },
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("AI error", response.status, txt);
      if (response.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (response.status === 402)
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");
    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-shop error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
