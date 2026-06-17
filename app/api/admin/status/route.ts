import { NextResponse } from "next/server";
import Stripe from "stripe";
import { SITE } from "@/lib/site";
import { getDict, isLocale, defaultLocale } from "@/lib/i18n";
import { sendMail, emailShell } from "@/lib/mail";
import { canManage } from "@/lib/role";

export const runtime = "nodejs";

interface Body {
  token?: string;
  sessionId?: string;
  fulfillment?: string;
  tracking?: string;
  proof?: string; // Blob URL of the final design proof image
}

/** Seller-only: set an order's status / tracking / design proof. When the
 *  status becomes "proof", emails the customer to review & approve.
 *  Protected by ADMIN_TOKEN. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const adminToken = process.env.ADMIN_TOKEN;
    const tokenOk = !!adminToken && body.token === adminToken;
    const roleOk = !tokenOk && (await canManage()); // admin/staff via Clerk
    if (!tokenOk && !roleOk) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Stripe not configured" }, { status: 400 });
    }
    if (!body.sessionId) {
      return NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
    }

    const stripe = new Stripe(secret);
    const meta: Record<string, string> = {};
    if (body.fulfillment) meta.fulfillment = body.fulfillment;
    meta.tracking = body.tracking ?? "";
    if (body.proof) {
      meta.proof = body.proof;
      meta.proofAt = new Date().toISOString(); // starts the auto-approve clock
      meta.approval = ""; // new proof → reset prior approval
      meta.feedback = "";
    }

    const session = await stripe.checkout.sessions.retrieve(body.sessionId);
    const piId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    if (piId) {
      await stripe.paymentIntents.update(piId, { metadata: meta });
    } else {
      await stripe.checkout.sessions.update(body.sessionId, { metadata: meta });
    }

    // Notify the customer when their design proof is ready to review.
    if (meta.fulfillment === "proof") {
      const to = session.customer_details?.email || session.customer_email;
      const loc = session.metadata?.locale;
      const locale = isLocale(loc) ? loc : defaultLocale;
      const t = getDict(locale).email;
      const url = `${SITE.url}/track?id=${encodeURIComponent(body.sessionId)}`;
      await sendMail(
        to,
        t.proofSubject,
        emailShell({ heading: t.proofHeading, body: t.proofBody, ctaLabel: t.proofCta, ctaUrl: url, footer: t.footer }),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
