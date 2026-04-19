
# Smart Wallet + AI Shopping Assistant — MVP Plan

A conversational AI commerce demo where users describe what they want, get 3 AI-curated options, choose how to pay (instant / BNPL / credit), and track delivery — all in one clean interface.

## Design Direction
- **Style**: Clean Light, Apple-like minimalism, conversational
- **Palette**: Soft whites/grays with vibrant blue (#3b82f6) accent for actions & AI moments
- **Typography**: Outfit (headings) + Figtree (body)
- **Mood**: Calm, trustworthy, premium — fintech-grade polish

## Core Screens

1. **Landing / Auth** — hero pitch + email sign-in/sign-up (Lovable Cloud auth)
2. **Chat Home** — conversational AI input ("I need a phone under 3000 MAD"), suggested prompts, recent searches
3. **Recommendation View** — 3 AI-generated product cards side-by-side: image, price (MAD), rating, delivery ETA, "why we picked this" reasoning
4. **Payment Decision Sheet** — for selected product, three options:
   - Pay now (deduct from wallet)
   - BNPL (3x / 4x installments preview)
   - Credit financing (partner bank offer with monthly cost)
5. **Wallet Dashboard** — balance, top-up (mock), spending breakdown, active BNPL installments
6. **Orders & Tracking** — order list with live status timeline (Confirmed → Shipped → Out for delivery → Delivered), simulated progression
7. **Order detail / Chat thread** — post-purchase updates appear in chat

## AI Behavior (Lovable AI Gateway, Gemini)
- **Intent parsing + product generation** in one structured call: returns 3 realistic products with name, brand, price MAD, rating, delivery days, key specs, and a one-line "why" rationale
- **Streaming chat responses** for a real assistant feel
- **Affordability logic**: AI suggests best payment method based on price vs. wallet balance (e.g. recommends BNPL if price > 50% of balance)

## Backend (Lovable Cloud)
- **Auth**: email/password, profile auto-created on signup
- **Tables**: `profiles`, `wallets` (balance), `orders`, `order_events` (tracking timeline), `bnpl_installments`, `chat_messages`
- **RLS**: users only see their own data
- **Edge functions**: `ai-shop` (intent → 3 products, streaming), `checkout` (creates order, debits wallet or schedules installments, seeds tracking events)
- **Mock tracking**: edge function or interval advances order status over short demo intervals

## Demo Polish
- Pre-seeded wallet balance (e.g. 5000 MAD) on signup so users can immediately transact
- Suggested prompt chips: "Phone under 3000 MAD", "Wireless headphones for gym", "Laptop for design work"
- Smooth micro-animations on AI responses & payment selection
- Mobile-first responsive (current viewport is mobile)

## Out of Scope (Phase 2+)
Real merchant APIs, real payment rails, real bank integrations, voice input, push notifications, merchant/bank dashboards.
