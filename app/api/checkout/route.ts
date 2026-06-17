import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { SITE } from "@/lib/site";
import { type Customization } from "@/lib/products";
import { getDict, isLocale, defaultLocale, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";

interface CheckoutBody {
  customization: Customization;
  priceCents: number;
  artworkUrl?: string; // public URL from /api/order (or data URL fallback)
  originalUrl?: string; // the customer's original upload (for tracking/share)
  email?: string;
  locale?: Locale;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody;
    const { customization: c, priceCents } = body;
    const locale = isLocale(body.locale) ? body.locale : defaultLocale;
    const t = getDict(locale);

    const styleLabel = t.product.styles[c.style]?.label ?? c.style;
    const metalLabel = t.product.metals[c.metal]?.label ?? c.metal;
    const chainLabel = t.product.chains[c.chain]?.label ?? c.chain;
    const descParts = [styleLabel, metalLabel, `${chainLabel} ${c.length}`];
    if (c.engraving) descParts.push(`${t.studio.summary.engraving}: "${c.engraving}"`);
    const description = descParts.join(" · ");

    const origin = req.headers.get("origin") || SITE.url;
    const secret = process.env.STRIPE_SECRET_KEY;

    // If the buyer is signed in, tag the order so it shows in their history.
    const { userId } = await auth();

    // Metadata the seller reads to fulfil the order (forward to Taobao maker).
    const metadata: Record<string, string> = {
      style: c.style,
      metal: c.metal,
      chain: c.chain,
      length: c.length,
      engraving: c.engraving || "",
      notes: c.notes || "",
      userId: userId || "",
      // Stripe metadata values cap at 500 chars; an http(s) Blob URL fits, a
      // long data URL does not — only attach when it's a real link.
      artwork:
        body.artworkUrl && body.artworkUrl.startsWith("http")
          ? body.artworkUrl
          : "uploaded (see Blob store / email)",
      original:
        body.originalUrl && body.originalUrl.startsWith("http") ? body.originalUrl : "",
      locale,
    };

    // ---- Demo mode: no Stripe key yet → simulate a successful order ----
    if (!secret) {
      const params = new URLSearchParams({
        demo: "1",
        amount: String(priceCents),
        desc: description,
      });
      return NextResponse.json({ url: `${origin}/success?${params.toString()}` });
    }

    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: body.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: SITE.currency,
            unit_amount: priceCents,
            product_data: {
              name: `${SITE.name} Custom Keepsake Necklace`,
              description,
              images:
                body.artworkUrl && body.artworkUrl.startsWith("http")
                  ? [body.artworkUrl]
                  : undefined,
            },
          },
        },
      ],
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "JP", "SG", "DE", "FR", "NL"],
      },
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
