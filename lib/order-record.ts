import "server-only";
import type Stripe from "stripe";
import { markOrderPaid, upsertOrder } from "@/lib/db/designs";
import { promoCodeOf, shipTo } from "@/lib/shipping";

/**
 * Persist a paid Stripe Checkout session to the DB. Called from both the
 * /success page and the webhook (defense in depth) — safe to call repeatedly.
 *
 * New checkouts carry `metadata.orderId` (the pending order + items created
 * before redirecting to Stripe) → we just flip it to paid. Older sessions and
 * reorders fall back to the legacy single-row upsert.
 */
export async function recordOrderFromSession(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
  const m = (session.metadata ?? {}) as Record<string, string>;
  const email = session.customer_details?.email || session.customer_email || null;
  const ship = shipTo(session);

  if (m.orderId) {
    await markOrderPaid(m.orderId, {
      stripeSessionId: session.id,
      email,
      amountJpy: session.amount_total ?? null,
      shipName: ship.name || null,
      shipAddress: ship.copy || null,
      phone: ship.phone || null,
      promoCode: promoCodeOf(session),
    });
    return;
  }

  const spec = JSON.stringify({
    form: m.form || "necklace",
    style: "enamel",
    metal: m.metal || "gold",
    chain: m.chain || "cable",
    length: m.length || "",
    engraving: m.engraving || "",
    notes: m.notes || "",
  });
  await upsertOrder({
    stripeSessionId: session.id,
    userId: m.userId || null,
    email,
    amountJpy: session.amount_total ?? null,
    status: "received",
    artworkUrl: m.artwork?.startsWith("http") ? m.artwork : null,
    originalUrl: m.original?.startsWith("http") ? m.original : null,
    spec,
  });
}
