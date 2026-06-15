# Keepsy 🧡

A custom keepsake-jewelry storefront: customers turn a **child's drawing** or a
**pet/child photo** into a handcrafted necklace. Upload → instant AI preview →
customize → pay → you fulfil via your Taobao maker.

Built with **Next.js 16 (App Router) + React 19 + Tailwind 4**, deployed on
**Vercel**. AI preview via **OpenAI `gpt-image-1`**, payments via **Stripe
Checkout**, artwork storage via **Vercel Blob**.

## The customer funnel

1. **Land** → hero with a "Watch how it works" video slot + free-preview CTA.
2. **/studio** → upload a photo, pick a style (enamel / engraved / photo). The
   `/api/generate` route stylizes it with OpenAI; if AI is unavailable it falls
   back to an instant on-canvas preview so the UI never breaks.
3. **Customize** → metal, chain, length, engraving — live price + live preview card.
4. **Checkout** → `/api/order` stores the artwork (Vercel Blob), `/api/checkout`
   creates a Stripe Checkout session. The order's customization + artwork URL ride
   along in Stripe **metadata** so you can fulfil it.
5. **/success** → confirmation + what-happens-next timeline.

## Going live (do this in the morning)

Everything is wired and deploys in **demo mode** out of the box (preview works,
checkout simulates success). To take real money:

1. **Stripe** (recommended over PayPal/Shopify for a solo seller — see below):
   - Create an account → grab your secret key from the dashboard.
   - Add `STRIPE_SECRET_KEY` in Vercel → Settings → Environment Variables → redeploy.
   - Checkout now charges real cards (+ Apple/Google Pay automatically).
2. **Artwork capture**: Vercel → Storage → **Blob** → create store. It injects
   `BLOB_READ_WRITE_TOKEN`. Now every order's photo is saved and linked in Stripe.
3. **Find orders, artwork & addresses** — two ways:
   - **Built-in dashboard** (easiest): visit `/admin/orders?token=YOUR_ADMIN_TOKEN`.
     It lists every order with a **"作品をダウンロード / Download artwork"** link (the
     image to send your Taobao maker), the **shipping address**, the spec, and notes.
     Set `ADMIN_TOKEN` in `.env.local` / Vercel to any secret string.
   - **Stripe Dashboard** → Payments. Each payment's **metadata** holds the spec +
     artwork URL; the **shipping address** is on the payment/session itself.
   The raw artwork files live in your **Vercel Blob** store (`orders/…`).
4. (Optional) Add `NEXT_PUBLIC_HERO_VIDEO` (YouTube embed or .mp4) for the hero video.
5. (Optional) Point a custom domain in Vercel → Settings → Domains.

## Languages (日本語 / English)

The site is **Japanese by default** (primary market) with an instant **JA / EN
toggle** in the header. Copy lives in `lib/i18n.ts` (`ja` is the source of truth,
`en` must match its shape). Locale is stored in a cookie so server-rendered pages
and SEO metadata follow it too.

## The cloisonné look (AI preview)

The real pendants fill each colour cell with **coloured sand + UV resin**,
separated by **metal divider walls** — no two colours ever touch.
`app/api/generate/route.ts` prompts `gpt-image-1` for exactly that, and the
offline canvas fallback (`lib/stylize.ts`) draws metal walls between colour blocks
with a sandy grain, using the chosen metal (gold/silver/rose) for the dividers.

### Why Stripe (not Shopify or PayPal)?

- **vs Shopify** — no $29+/mo, and the bespoke upload→AI-preview→order flow is hard
  inside Shopify without paid apps. This custom store gives full control at ~$0 fixed cost.
- **vs PayPal** — Stripe Checkout is a polished hosted page, easy solo onboarding in
  Japan, cleaner API. PayPal can be added later as a second button if you want it.

## Local development

```bash
npm install
cp .env.example .env.local   # add OPENAI_API_KEY at minimum
npm run dev
```

## Regenerate marketing imagery

```bash
node scripts/gen-assets.mjs   # needs OPENAI_API_KEY; writes public/gallery/*
```

## Project map

```
app/
  page.tsx              Landing (hero, how-it-works, gallery, reviews, FAQ, CTA)
  studio/page.tsx       The upload → preview → customize → checkout wizard
  success/page.tsx      Order confirmation
  api/generate/route.ts OpenAI image stylization (+ graceful fallback)
  api/order/route.ts    Artwork persistence (Vercel Blob)
  api/checkout/route.ts Stripe Checkout (+ demo-mode fallback)
components/             Header, Footer, Hero, NecklacePreviewCard, Faq
lib/                    site config, product catalogue/pricing, canvas fallback
```
