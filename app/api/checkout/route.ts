import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { SITE } from "@/lib/site";
import { type Customization } from "@/lib/products";
import { getDict, isLocale, defaultLocale, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";

interface CartItemBody {
  customization: Customization;
  priceCents: number;
  artworkUrl?: string;
  originalUrl?: string;
}

interface CheckoutBody {
  // Multi-item cart (preferred path)
  items?: CartItemBody[];
  // Legacy single-item path (kept for backwards compat)
  customization?: Customization;
  priceCents?: number;
  artworkUrl?: string;
  originalUrl?: string;
  email?: string;
  locale?: Locale;
}

function itemDescription(c: Customization, t: ReturnType<typeof getDict>): string {
  const formLabel = t.product.forms?.[c.form]?.label ?? c.form ?? "necklace";
  const metalLabel = t.product.metals[c.metal]?.label ?? c.metal;
  const parts = [formLabel, metalLabel];
  if (c.form === "necklace") parts.push(c.length);
  if (c.engraving) parts.push(`${t.studio.summary.engraving}: "${c.engraving}"`);
  return parts.join(" · ");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody;
    const locale = isLocale(body.locale) ? body.locale : defaultLocale;
    const t = getDict(locale);

    // Normalise to a cart array (backwards-compat single-item fallback).
    const items: CartItemBody[] =
      body.items && body.items.length > 0
        ? body.items
        : body.customization
          ? [
              {
                customization: body.customization,
                priceCents: body.priceCents ?? 0,
                artworkUrl: body.artworkUrl,
                originalUrl: body.originalUrl,
              },
            ]
          : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    const origin = req.headers.get("origin") || SITE.url;
    const secret = process.env.STRIPE_SECRET_KEY;
    const { userId } = await auth();

    // ---- Demo mode ----
    if (!secret) {
      const totalAmount = items.reduce((sum, it) => sum + it.priceCents, 0);
      const desc = items.map((it) => itemDescription(it.customization, t)).join(" + ");
      const params = new URLSearchParams({ demo: "1", amount: String(totalAmount), desc });
      return NextResponse.json({ url: `${origin}/success?${params.toString()}` });
    }

    const stripe = new Stripe(secret);

    const line_items = items.map((it, idx) => {
      const c = it.customization;
      const description = itemDescription(c, t);
      return {
        quantity: 1,
        price_data: {
          currency: SITE.currency,
          unit_amount: it.priceCents,
          product_data: {
            name: `${SITE.name} Custom Charm #${idx + 1}`,
            description,
            images:
              it.artworkUrl && it.artworkUrl.startsWith("http") ? [it.artworkUrl] : undefined,
          },
        },
      };
    });

    // Store per-item metadata as a JSON blob (Stripe top-level metadata is flat).
    const metadata: Record<string, string> = {
      userId: userId || "",
      locale,
      itemCount: String(items.length),
      items: JSON.stringify(
        items.map((it) => ({
          form: it.customization.form,
          style: it.customization.style,
          metal: it.customization.metal,
          chain: it.customization.chain,
          length: it.customization.length,
          engraving: it.customization.engraving || "",
          notes: it.customization.notes || "",
          artwork:
            it.artworkUrl && it.artworkUrl.startsWith("http")
              ? it.artworkUrl
              : "see blob store",
          original:
            it.originalUrl && it.originalUrl.startsWith("http") ? it.originalUrl : "",
        })),
      ).slice(0, 500), // Stripe metadata cap
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: body.email || undefined,
      line_items,
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "JP", "SG", "DE", "FR", "NL"],
      },
      phone_number_collection: { enabled: true },
      metadata,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/studio?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
