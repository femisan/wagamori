import { NextResponse } from "next/server";
import Stripe from "stripe";
import { SITE } from "@/lib/site";
import { sendMail, emailShell } from "@/lib/mail";

export const runtime = "nodejs";

interface Body {
  sessionId?: string;
  action?: "approve" | "changes";
  comment?: string;
}

/** Customer action on their design proof — keyed by the (unguessable) Stripe
 *  session id. Approve → advances to crafting. Changes → records feedback.
 *  Notifies the seller (SELLER_EMAIL) best-effort. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 400 });
    if (!body.sessionId || (body.action !== "approve" && body.action !== "changes")) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }

    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.retrieve(body.sessionId);
    const piId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    const meta: Record<string, string> =
      body.action === "approve"
        ? { approval: "approved", fulfillment: "crafting", feedback: "" }
        : { approval: "", feedback: (body.comment || "").slice(0, 450) };

    if (piId) {
      await stripe.paymentIntents.update(piId, { metadata: meta });
    } else {
      await stripe.checkout.sessions.update(body.sessionId, { metadata: meta });
    }

    // Notify the seller so they can act (best-effort).
    const seller = process.env.SELLER_EMAIL;
    const url = `${SITE.url}/admin/orders`;
    if (body.action === "approve") {
      await sendMail(
        seller,
        `[Wagamori] Design approved — ${body.sessionId.slice(0, 14)}…`,
        emailShell({ heading: "Customer approved the design", body: "Move this order into production.", ctaLabel: "Open admin", ctaUrl: url }),
      );
    } else {
      await sendMail(
        seller,
        `[Wagamori] Change requested — ${body.sessionId.slice(0, 14)}…`,
        emailShell({
          heading: "Customer requested changes",
          body: (body.comment || "(no comment)").slice(0, 450),
          ctaLabel: "Open admin",
          ctaUrl: url,
        }),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
