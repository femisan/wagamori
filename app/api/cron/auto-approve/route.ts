import { NextResponse } from "next/server";
import Stripe from "stripe";
import { proofExpired } from "@/lib/fulfillment";

export const runtime = "nodejs";

/**
 * Vercel Cron: auto-approve design proofs that have waited past the review
 * window, so orders never get stuck. Advances "proof" → "crafting".
 * Secured with CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.json({ ok: true, skipped: "no_stripe" });

  const stripe = new Stripe(sk);
  const now = Date.now();
  let advanced = 0;

  try {
    const res = await stripe.checkout.sessions.list({ limit: 100, expand: ["data.payment_intent"] });
    for (const s of res.data) {
      const pi = s.payment_intent && typeof s.payment_intent !== "string" ? s.payment_intent : null;
      const pm = (pi?.metadata ?? {}) as Record<string, string>;
      const sm = (s.metadata ?? {}) as Record<string, string>;
      const status = pm.fulfillment || sm.fulfillment;
      const approval = pm.approval || sm.approval;
      const proofAt = pm.proofAt || sm.proofAt;

      if (status === "proof" && !approval && proofExpired(proofAt, now)) {
        const meta = { fulfillment: "crafting", approval: "auto" };
        if (pi) await stripe.paymentIntents.update(pi.id, { metadata: meta });
        else await stripe.checkout.sessions.update(s.id, { metadata: meta });
        advanced++;
      }
    }
    return NextResponse.json({ ok: true, advanced });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
