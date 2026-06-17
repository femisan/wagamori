# Wagamori — Architecture

> **Wagamori (わが森)** is a custom keepsake-jewelry storefront. Customers upload a
> child's drawing or pet photo, an AI turns it into a cloisonné-style enamel
> pendant preview, they refine it in a chat, then order. Orders are produced by a
> Taobao maker and tracked through a design-proof → crafting → shipped lifecycle.

This document describes the system as built. For setup/launch steps see
[`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md); for the modified Next.js conventions
see [`AGENTS.md`](./AGENTS.md).

---

## 1. Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js 16.2.9** App Router | Middleware lives in `proxy.ts` (this fork renames it — see `AGENTS.md`). Turbopack. |
| UI runtime | **React 19.2.4** | Server Components by default; `"use client"` only where needed. |
| Styling | **Tailwind 4** | `app/globals.css`; design tokens (`--gold`, `--rose`, `--blush`) as CSS vars. Theme = 桜と金 Rose & Gold. |
| Language | **TypeScript 5** | `ja` i18n object is the source of truth; `en satisfies typeof ja`. |
| Auth | **Clerk v7** (`@clerk/nextjs` 7.5.2) | Email + Google. RBAC via `publicMetadata.role`; rate-limit counter in `privateMetadata`. |
| Database | **Neon Postgres** + **Drizzle ORM** 0.45 | `neon-http` serverless driver. |
| Image storage | **Vercel Blob** | Artwork, AI previews, proofs. |
| Payments | **Stripe Checkout** | Currency **JPY** (zero-decimal — `unit_amount` is yen as integer). |
| AI | **OpenAI `gpt-image-1`** | `images.edit` for both first generation and conversational edits. |
| Email | **Resend** | Tracking link + proof notifications. |
| Admin UI | **Ant Design v5** + **Pro Components** (ProTable) | Mounted at `/admin` inside the Next app via `@ant-design/nextjs-registry`. |
| Hosting | **Vercel** | Fluid Compute functions, Vercel Cron, Marketplace (Neon/Blob). Production is **public**. |

---

## 2. Customer funnel

```
  Landing (/)                       ← public marketing page (Hero, gallery, FAQ, reviews)
      │  upload drawing/photo
      ▼
  Studio (/studio)
   ├─ 1. FREE first preview         ← no login. /api/generate (gpt-image-1)
   ├─ 2. Refine (chat)              ← LOGIN-GATED. /api/edit, rate-limited
   │      subject mode + connection style + style chips + free-text instructions
   ├─ 3. Customize                  ← metal / chain / engraving → price (JPY)
   └─ 4. Checkout                   → /api/checkout → Stripe Checkout (JPY)
      │  payment success
      ▼
  Success (/success)                ← QR + "save this link" prompt; emails tracking link
      │
      ▼
  Track (/track?id=<session>)
   ├─ status timeline: received → proof → crafting → shipped
   ├─ design-proof approval         ← approve / request changes (ProofApproval)
   │      auto-proceeds to crafting after 2 days (PROOF_AUTO_APPROVE_DAYS)
   └─ shareable composite image     ← preview + original photo → one PNG (ShareCard)
```

**Why login is gated at step 2, not step 1.** The first preview is free to maximize
conversion (you see real output before committing). Conversational editing is the
expensive, repeatable AI call, so it requires a Clerk session and is rate-limited —
this is the cost-control boundary.

State survives the login round-trip via `sessionStorage` (flag `wagamori-resume`):
when a signed-out user clicks "edit", we stash `{preview, original, customization,
step, subjectMode, connectMode, designId}`, send them through Clerk's modal with
`forceRedirectUrl="/studio"`, and rehydrate on return. The flag gating prevents stale
state from leaking into a fresh visit (this was the cause of the early
"single cat → whole family" bug).

---

## 3. AI pipeline

All generation goes through `gpt-image-1` (`images.edit`). Prompts live in
`app/api/generate/route.ts` (and are reused by `app/api/edit/route.ts`).

**Two-step prompt** (`enamelPrompt`): _(1)_ flatten the photo into bold comic-style
colour blocks, _(2)_ render those blocks as **cloisonné** — every colour separated
by a metal divider wall, colours = UV-resin + coloured sand (matches the real craft).

Key prompt guards:

- **`NEVER_INVENT`** — use only subjects actually present in the image; a single cat
  must stay a single cat. (Fixes the family-hallucination bug.)
- **Isolation** — strip screenshot UI / background / clutter; extract the subject only.
- **`COLOR_FIDELITY`** — preserve the original drawing's palette (no yellow drift).

Two user-selectable axes:

| Axis | Values | Meaning |
|------|--------|---------|
| `SubjectMode` | `solo` (default) / `all` | keep one subject, or keep everyone present |
| `ConnectMode` | `linked` (default) / `joined` | separate charms + jump rings + chain, **or** one fused piece. Both modes forbid a floating, unattached bail ring. |

A pure-canvas fallback (`lib/stylize.ts`) draws metal divider walls + sandy grain
client-side when the API is unavailable, so the studio always shows something.

---

## 4. Data model

Neon Postgres via Drizzle (`lib/db/schema.ts`). Images are **not** stored in the DB —
only Blob URLs. Helper queries live in `lib/db/designs.ts`; the connection is guarded
(`lib/db/index.ts` exports `db = url ? drizzle(...) : null`) so the app runs without a
DB in demo mode.

```
designs
  id              text PK
  userId          text          (Clerk user id)
  title           text
  status          text          design lifecycle
  originalUrl     text          Blob URL of the uploaded photo
  selectedVersionId text        which version the customer/CS chose
  created/updated timestamps

designVersions
  id              text PK
  designId        text FK → designs
  round           int           0 = first AI preview, 1+ = edits
  source          text          'ai' | 'edit' | 'cs' | 'customer'
  instruction     text          the chat instruction that produced this version
  imageUrl        text          Blob URL
  style/metal/subjects/connection  the params used
  selected        bool
  createdAt       timestamp

orders
  id              text PK
  stripeSessionId text UNIQUE
  userId / designId / email
  amountJpy       int
  status          text
  tracking        text
  artworkUrl      text          finished pendant art (Blob URL) — for history + reorder
  originalUrl     text          customer's original upload
  spec            text          JSON of the Customization — for display + reorder
  created/updated timestamps
```

Versioning lets a customer fall back to "version 1" after several edits, and lets CS
upload a **manual proof** (`source = 'cs'`) as just another version.

**Fulfillment state** currently lives in **Stripe session/payment-intent metadata**
(`fulfillment`, `approval`, `proofAt`, `proof`, `tracking`), read by `/track` and the
admin. `lib/fulfillment.ts` derives the *effective* status: once the proof window
(`PROOF_AUTO_APPROVE_DAYS = 2`) elapses, status auto-advances to `crafting` so nothing
gets stuck waiting on the customer. The `orders` table mirrors this for DB-side
filtering at scale (next-phase wiring).

`app/api/admin/migrate/route.ts` (ADMIN_TOKEN-gated) runs `CREATE TABLE IF NOT EXISTS`
DDL at runtime on Vercel, where `DATABASE_URL` is available (it's write-only and not
pullable locally).

---

## 5. Auth & RBAC (Clerk)

- `proxy.ts` is bare `clerkMiddleware()` — it makes `auth()` available everywhere but
  **gates nothing**, keeping the whole site public. Gating happens per-route.
- **Edit access** (`lib/edit-access.ts`): `requireEditAccess()` needs a signed-in
  `userId`; enforces a daily cap (50) using a `{editDay, editCount}` counter in Clerk
  `privateMetadata`.
- **Roles** (`lib/role.ts`): `publicMetadata.role` is `admin` or `staff`.
  - `isAdmin()` → full access (price changes, deletes, user management).
  - `canManage()` → admin **or** staff. Staff can change order status / tracking and
    handle CS-draft uploads, but not pricing, deletes, or users.
- Clerk v7 API notes (differ from older docs): use `<Show when="signed-in|signed-out">`
  (not `<SignedIn>`/`<SignedOut>`); `UserButton.MenuItems` + `UserButton.Link` for the
  "マイデザイン" menu entry; `auth()` / `currentUser()` / `clerkClient` from
  `@clerk/nextjs/server`.

---

## 6. Admin (`/admin`)

Ant Design Pro **ProTable** mounted inside Next via `AntdRegistry` (SSR-safe). Gated in
`app/admin/layout.tsx` — no role → "Admins only".

| Page | Purpose |
|------|---------|
| `/admin` | Dashboard cards → 注文管理 / デザイン管理 |
| `/admin/orders` | ProTable of Stripe sessions: artwork thumb, order/email, spec, address, amount (sortable), paid (filter), status (filter), edit modal (status + tracking). Keyword search. Horizontal scroll (`scroll={{x:1040}}`) so it doesn't wrap on mobile. |
| `/admin/designs` | ProTable of designs + Drawer showing version history; "この版を採用" (select a version) and "CS手動稿をアップ" (upload a manual proof). |

Backing APIs (`/api/admin/*`) are all `canManage()`-gated; `/api/admin/status`
additionally accepts an `ADMIN_TOKEN` for legacy token access.

---

## 7. Order lifecycle, proof & notifications

1. **Checkout** → Stripe `checkout.session.completed` webhook
   (`/api/stripe/webhook`) → `sendTrackingEmail` (Resend) with the `/track` link.
2. **Proof**: seller/CS uploads a proof image (admin) → status `proof`, `proofAt`
   stamped → customer sees it on `/track` with **approve / request changes**
   (`ProofApproval` → `/api/proof`).
   - Approve → status `crafting`, `approval=approved`.
   - Request changes → feedback emailed to `SELLER_EMAIL`.
3. **Auto-approve**: Vercel Cron (`vercel.json`, daily `0 3 * * *`) hits
   `/api/cron/auto-approve` (CRON_SECRET-gated). `effectiveStatus()` also advances any
   order whose proof window has lapsed, so tracking is correct even between cron runs.
4. **Shipped**: admin sets status + tracking number; shown on `/track`.

Email is templated in `lib/mail.ts` (`sendMail` + `emailShell`). No mail server
needed — Resend handles delivery.

## 7b. Order history & reorder

Logged-in customers see their orders without digging through email.

- **Capture**: `/api/checkout` tags the Stripe session metadata with the Clerk `userId`.
  `recordOrderFromSession` (`lib/order-record.ts`) upserts the order into the `orders`
  table (userId, amount, email, `artworkUrl`, `originalUrl`, `spec` JSON) — called both
  from the `/success` page render and the Stripe webhook (defense in depth). Only orders
  tied to a signed-in account are recorded; guests have no history to attach.
- **History**: `/my-orders` (Clerk-gated) lists the user's orders via
  `listOrdersByUser(userId)` — thumbnail, colour/engraving, date, status, amount, a
  `/track` link, and a reorder button. Linked from the `UserButton` menu.
- **Reorder**: `ReorderButton` → `POST /api/reorder` verifies ownership
  (`getOrderForUser`) and creates a fresh Stripe Checkout session from the stored
  `artworkUrl` + `spec` + `amountJpy` — same piece, same settings, no studio round-trip.

---

## 8. i18n

- `lib/i18n.ts` — all UI copy. `ja` is the source of truth (Japanese default);
  `en satisfies typeof ja` guarantees the English object has every key.
- `lib/i18n-server.ts` — reads the `lang` cookie via `next/headers` for Server
  Components (`getServerT`).
- `components/LangProvider.tsx` — client context (`useI18n`) + `LangToggle` writes the
  cookie. `app/layout.tsx` localizes metadata.

---

## 9. Sharing (`ShareCard` / `lib/share.ts`)

`composeShareImage` draws the necklace preview big with the customer's **original
photo inset bottom-right**, merged into one downloadable/shareable PNG. `loadImage`
fetches `http(s)` URLs into object URLs to avoid canvas taint and to keep multi-MB
data URLs out of the RSC payload (passing huge data URLs as props previously broke
hydration — `/track` now passes small Blob URLs to the client, which fetches +
composes there).

---

## 9b. Buyer-show gallery (`/showcase`)

Customers upload photos of the real piece they received; others like them.

- **Table** `showcase_posts` (id, userId, imageUrl, caption, metal, status `visible|hidden`, likes, createdAt). Helpers in `lib/db/showcase.ts`.
- **Upload** requires a Clerk login (anti-spam/accountability) → `POST /api/showcase` stores the photo in Vercel Blob (`kind="showcase"`) and inserts a row. Auto-published (`status='visible'`).
- **Likes are anonymous** — `POST /api/showcase/like` increments a counter; the client dedupes per-device via `localStorage` (`wagamori-showcase-liked`). No per-user like table.
- **Pages**: `/showcase` (server-rendered initial list + `ShowcaseBoard` client component for upload / like / load-more); a homepage `ShowcaseTeaser` that fetches the latest posts client-side and stays hidden until at least one exists.
- **Moderation**: `/admin/showcase` (ProTable, `canManage`-gated) → hide / show / delete via `POST /api/admin/showcase`.

## 10. Routes at a glance

**Pages:** `/` · `/studio` · `/success` · `/track` · `/showcase` · `/my-designs` ·
`/my-designs/[id]` · `/my-orders` · `/admin` · `/admin/orders` · `/admin/designs` ·
`/admin/showcase` · `/sign-in` · `/sign-up`

**API:** `/api/generate` · `/api/edit` (auth + rate-limit) · `/api/checkout` ·
`/api/order` · `/api/reorder` (auth) · `/api/stripe/webhook` · `/api/proof` ·
`/api/design/select` · `/api/showcase` (GET public / POST auth) · `/api/showcase/like` ·
`/api/cron/auto-approve` · `/api/admin/{orders,designs,status,showcase,showcase/seed,migrate}`

`/api/generate` and `/api/edit` set `maxDuration = 120` (image generation is slow).

---

## 11. Environment variables

See `.env.example` for the full annotated list. Grouped:

| Group | Vars |
|-------|------|
| AI | `OPENAI_API_KEY` |
| Auth | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| DB | `DATABASE_URL` (Neon) |
| Storage | `BLOB_READ_WRITE_TOKEN` (Vercel Blob) |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `SELLER_EMAIL` |
| Admin/Cron | `ADMIN_TOKEN`, `CRON_SECRET` |
| Site | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_HERO_VIDEO` (optional), `NEXT_PUBLIC_LINE_URL` (legacy/optional) |

The app degrades gracefully: missing Stripe → demo checkout; missing DB → no
persistence; missing OpenAI → canvas fallback preview.

---

## 12. Third-party services

OpenAI (gpt-image-1) · Clerk (auth) · Neon (Postgres) · Vercel (hosting, Blob, Cron) ·
Stripe (payments) · Resend (email). Fulfillment is a manual handoff to a Taobao maker
using the artwork/proof downloaded from the admin.
