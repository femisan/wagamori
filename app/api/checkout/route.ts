import { NextResponse } from "next/server";
import Stripe from "stripe";
import { SITE } from "@/lib/site";
import { getActor } from "@/lib/actor";
import { allowedMetals, normalizeCustomization, priceFor, type Customization, type DesignMode } from "@/lib/products";
import { getDict, isLocale, defaultLocale, variantLabel, type Locale } from "@/lib/i18n";
import {
  attachStripeSession,
  createPendingOrder,
  getDesignForActor,
  getVersion,
  type PendingItem,
} from "@/lib/db/designs";

export const runtime = "nodejs";

interface CartItemBody {
  customization: Partial<Customization>;
  designId?: string | null;
  versionId?: string | null;
  designMode?: DesignMode; // "human" = customer asked a designer to make the design
  designBrief?: string;
  // Fallbacks for when the DB/Blob history isn't available (demo / local).
  artworkUrl?: string;
  originalUrl?: string;
}

interface CheckoutBody {
  items?: CartItemBody[];
  email?: string;
  locale?: Locale;
}

function itemDescription(c: Customization, t: ReturnType<typeof getDict>, mode: DesignMode = "ai"): string {
  const formLabel = t.product.forms[c.form]?.label ?? c.form;
  const parts = [formLabel, variantLabel(t, c.material, c.metal)];
  if (mode === "human") parts.push(t.studio.human.badge);
  if (c.form === "necklace") parts.push(c.length);
  if (c.engraving) parts.push(`${t.studio.summary.engraving}: "${c.engraving}"`);
  return parts.join(" · ");
}

const httpOnly = (u?: string | null) => (u && u.startsWith("http") ? u : null);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody;
    const locale = isLocale(body.locale) ? body.locale : defaultLocale;
    const t = getDict(locale);
    const raw = (body.items ?? []).slice(0, 20);
    if (raw.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    const actor = await getActor();

    // Resolve each item server-side: clamp options to the material, recompute the
    // price, and take artwork/original from the saved design (not the client).
    const items: Array<PendingItem & { c: Customization; designMode: DesignMode }> = [];
    for (const it of raw) {
      let c = normalizeCustomization(it.customization ?? {});
      let artworkUrl = httpOnly(it.artworkUrl);
      let originalUrl = httpOnly(it.originalUrl);
      let designId: string | null = null;
      let versionId: string | null = null;
      if (it.designId) {
        const d = await getDesignForActor(it.designId, actor);
        if (d) {
          designId = d.id;
          originalUrl = d.originalUrl ?? originalUrl;
          const v = it.versionId ? await getVersion(it.versionId) : null;
          if (v && v.designId === d.id) {
            versionId = v.id;
            artworkUrl = v.imageUrl;
            // The artwork's metal colour is fixed by the version; keep the chosen material
            // if it offers that colour (else silver, which offers every colour).
            if (v.metal && v.metal !== c.metal) {
              const metal = v.metal as Customization["metal"];
              const material = allowedMetals(c.material).includes(metal) ? c.material : "silver";
              c = normalizeCustomization({ ...c, material, metal });
            }
          }
        }
      }
      const designMode: DesignMode = it.designMode === "human" ? "human" : "ai";
      items.push({
        c,
        designMode,
        designBrief: designMode === "human" ? (it.designBrief ?? "").toString().trim().slice(0, 1000) || null : null,
        designId,
        versionId,
        artworkUrl,
        originalUrl,
        material: c.material,
        metal: c.metal,
        form: c.form,
        engraving: c.engraving || null,
        notes: c.notes || null,
        priceJpy: priceFor(c, designMode),
      });
    }

    const origin = req.headers.get("origin") || SITE.url;
    const secret = process.env.STRIPE_SECRET_KEY;

    // ---- Demo mode ----
    if (!secret) {
      const totalAmount = items.reduce((sum, it) => sum + it.priceJpy, 0);
      const desc = items.map((it) => itemDescription(it.c, t, it.designMode)).join(" + ");
      const params = new URLSearchParams({ demo: "1", amount: String(totalAmount), desc });
      return NextResponse.json({ url: `${origin}/success?${params.toString()}` });
    }

    const email = body.email?.trim() || actor.email || null;
    const order = await createPendingOrder({ userId: actor.userId, email, items }).catch(() => null);

    const stripe = new Stripe(secret);
    const line_items = items.map((it, idx) => ({
      quantity: 1,
      price_data: {
        currency: SITE.currency,
        unit_amount: it.priceJpy,
        product_data: {
          name: `${SITE.name} Custom Charm #${idx + 1}`,
          description: itemDescription(it.c, t, it.designMode),
          images: it.artworkUrl ? [it.artworkUrl] : undefined,
        },
      },
    }));

    // Stripe metadata: ≤50 keys, ≤500 chars per value. The DB order (orderId) is
    // the source of truth; per-item keys are a fallback, and the flat keys mirror
    // item #1 so /track, reorder and older admin code keep working.
    const first = items[0];
    const metadata: Record<string, string> = {
      userId: actor.userId || "",
      orderId: order?.id || "",
      locale,
      itemCount: String(items.length),
      form: first.form,
      style: "enamel",
      material: first.material,
      metal: first.metal,
      length: first.c.length,
      engraving: first.c.engraving || "",
      notes: (first.c.notes || "").slice(0, 490),
      artwork: first.artworkUrl || "",
      original: first.originalUrl || "",
      // Any designer-made piece → post-payment designer handoff (webhook + success page).
      human: items.some((it) => it.designMode === "human") ? "1" : "",
    };
    items.forEach((it, i) => {
      if (i >= 30) return;
      const v = JSON.stringify({
        f: it.form,
        t: it.material,
        m: it.metal,
        e: it.engraving || "",
        a: it.artworkUrl || "",
        o: it.originalUrl || "",
        d: it.designId || "",
        v: it.versionId || "",
        ...(it.designMode === "human" ? { h: 1, b: (it.designBrief || "").slice(0, 120) } : {}),
      });
      if (v.length <= 500) metadata[`item${i}`] = v;
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items,
      allow_promotion_codes: true,
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "JP", "SG", "DE", "FR", "NL"],
      },
      phone_number_collection: { enabled: true },
      metadata,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/studio?canceled=1`,
    });

    if (order) await attachStripeSession(order.id, session.id).catch(() => {});

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
