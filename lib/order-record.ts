import "server-only";
import type Stripe from "stripe";
import { upsertOrder } from "@/lib/db/designs";

/**
 * Persist an order to the DB from a Stripe Checkout session, so logged-in
 * customers see it in their order history (and can reorder). Only records
 * orders tied to a Clerk account (metadata.userId set at checkout) — guests
 * have no account to attach history to. Safe to call repeatedly (upsert).
 */
export async function recordOrderFromSession(session: Stripe.Checkout.Session) {
  const m = (session.metadata ?? {}) as Record<string, string>;
  const userId = m.userId || null;
  if (!userId) return;

  const spec = JSON.stringify({
    style: m.style || "enamel",
    metal: m.metal || "gold",
    chain: m.chain || "cable",
    length: m.length || "",
    engraving: m.engraving || "",
    notes: m.notes || "",
  });

  await upsertOrder({
    stripeSessionId: session.id,
    userId,
    email: session.customer_details?.email || session.customer_email || null,
    amountJpy: session.amount_total ?? null,
    status: "received",
    artworkUrl: m.artwork?.startsWith("http") ? m.artwork : null,
    originalUrl: m.original?.startsWith("http") ? m.original : null,
    spec,
  });
}
