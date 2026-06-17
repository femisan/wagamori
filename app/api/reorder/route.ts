import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { SITE } from "@/lib/site";
import { getOrderForUser } from "@/lib/db/designs";
import { getDict, isLocale, defaultLocale } from "@/lib/i18n";
import { type Customization } from "@/lib/products";

export const runtime = "nodejs";

// Re-purchase an existing order with the same settings + artwork.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  if (!orderId) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const order = await getOrderForUser(orderId, userId);
  if (!order) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const secret = process.env.STRIPE_SECRET_KEY;
  const origin = req.headers.get("origin") || SITE.url;

  let c: Customization;
  try {
    c = JSON.parse(order.spec || "{}");
  } catch {
    c = {} as Customization;
  }
  const localeRaw = (order as { locale?: string }).locale || defaultLocale;
  const locale = isLocale(localeRaw) ? localeRaw : defaultLocale;
  const t = getDict(locale);

  const metalLabel = t.product.metals[c.metal as keyof typeof t.product.metals]?.label ?? c.metal ?? "";
  const descParts = [t.studio.summary.itemValue, metalLabel];
  if (c.engraving) descParts.push(`${t.studio.summary.engraving}: "${c.engraving}"`);
  const description = descParts.filter(Boolean).join(" · ");
  const amount = order.amountJpy ?? 0;

  // Demo mode (no Stripe key): bounce to the success page.
  if (!secret) {
    const params = new URLSearchParams({ demo: "1", amount: String(amount), desc: description });
    return NextResponse.json({ url: `${origin}/success?${params.toString()}` });
  }

  const metadata: Record<string, string> = {
    style: c.style || "enamel",
    metal: c.metal || "gold",
    chain: c.chain || "cable",
    length: c.length || "",
    engraving: c.engraving || "",
    notes: c.notes || "",
    userId,
    artwork: order.artworkUrl || "",
    original: order.originalUrl || "",
    reorderOf: order.stripeSessionId || "",
    locale,
  };

  const stripe = new Stripe(secret);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: order.email || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: SITE.currency,
          unit_amount: amount,
          product_data: {
            name: `${SITE.name} Custom Keepsake Necklace`,
            description,
            images: order.artworkUrl?.startsWith("http") ? [order.artworkUrl] : undefined,
          },
        },
      },
    ],
    shipping_address_collection: {
      allowed_countries: ["US", "CA", "GB", "AU", "JP", "SG", "DE", "FR", "NL"],
    },
    metadata,
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/my-orders?canceled=1`,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
