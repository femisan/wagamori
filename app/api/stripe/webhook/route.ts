import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { SITE } from "@/lib/site";
import { getDict, isLocale, defaultLocale } from "@/lib/i18n";
import { recordOrderFromSession } from "@/lib/order-record";

export const runtime = "nodejs";

/**
 * Stripe webhook → emails the customer their order-tracking link so they never
 * lose it. Listens for `checkout.session.completed`.
 *
 * Setup (see LAUNCH_CHECKLIST.md):
 *   - STRIPE_WEBHOOK_SECRET  (from the Stripe webhook endpoint)
 *   - RESEND_API_KEY         (Resend)
 *   - EMAIL_FROM             (e.g. "Wagamori <orders@yourdomain.com>")
 * Missing any of these → the route safely no-ops (still returns 200).
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }

  const stripe = new Stripe(secret);
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad signature";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await recordOrderFromSession(session);
    } catch (e) {
      console.error("[webhook] record order threw:", e instanceof Error ? e.message : String(e));
    }
    try {
      const r = (await sendTrackingEmail(session)) as Record<string, unknown> | undefined;
      console.log("[webhook] emailId:", r?.id ?? "none");
      console.log("[webhook] emailSkipped:", r?.skipped ?? "none");
      console.log("[webhook] emailError:", r?.error ? JSON.stringify(r.error) : "none");
    } catch (e) {
      console.error("[webhook] email threw:", e instanceof Error ? e.message : String(e));
    }
  }

  return NextResponse.json({ ok: true });
}

async function sendTrackingEmail(session: Stripe.Checkout.Session) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: "no_resend_key" };

  const to = session.customer_details?.email || session.customer_email;
  if (!to) return { skipped: "no_recipient" };

  const localeRaw = (session.metadata?.locale as string) || defaultLocale;
  const locale = isLocale(localeRaw) ? localeRaw : defaultLocale;
  const t = getDict(locale).email;

  const trackUrl = `${SITE.url}/track?id=${encodeURIComponent(session.id)}`;
  const from = process.env.EMAIL_FROM || "Wagamori <onboarding@resend.dev>";

  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#4a2530">
    <p style="font-size:18px;letter-spacing:3px;color:#ca8a04;margin:0 0 16px">WAGAMORI</p>
    <h1 style="font-size:22px;margin:0 0 8px">${t.heading}</h1>
    <p style="color:#9b7a80;line-height:1.6;margin:0 0 20px">${t.body}</p>
    <a href="${trackUrl}" style="display:inline-block;background:#d2a235;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${t.cta}</a>
    <p style="font-size:12px;color:#9b7a80;margin:24px 0 0;word-break:break-all">${trackUrl}</p>
    <p style="font-size:12px;color:#9b7a80;margin:16px 0 0">お問い合わせ / Contact: <a href="mailto:${SITE.email}" style="color:#ca8a04">${SITE.email}</a></p>
    <p style="font-size:12px;color:#c9b8bc;margin:8px 0 0">${t.footer}</p>
  </div>`;

  const resend = new Resend(apiKey);
  const res = await resend.emails.send({ from, to, subject: t.subject, html, replyTo: SITE.email });
  return { to, from, id: res.data?.id ?? null, error: res.error ?? null };
}
