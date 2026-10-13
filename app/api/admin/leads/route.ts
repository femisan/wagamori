import { NextResponse } from "next/server";
import Stripe from "stripe";
import { currentUser } from "@clerk/nextjs/server";
import { canManage, isAdmin } from "@/lib/role";
import { listLeads, contactsByEmails, recordSend } from "@/lib/db/leads";
import { discountEmailHtml, newPromoCode, sendMarketingMail, unsubscribeLinks } from "@/lib/marketing";
import { SITE } from "@/lib/site";
import { db } from "@/lib/db";
import { marketingSends } from "@/lib/db/schema";
import { and, gte, inArray } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Don't send the same person another discount within this window.
const COOLDOWN_DAYS = 14;

export async function GET() {
  if (!(await canManage())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, data: await listLeads() });
}

type Target = { email: string; designId?: string | null; thumb?: string | null; userId?: string | null };

/**
 * Send a discount email to selected not-yet-ordered leads. Admin-only (it
 * creates real Stripe discounts). Only opted-in, not-unsubscribed contacts
 * outside the cooldown are emailed; each gets a single-use promotion code.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as {
    targets?: Target[];
    percentOff?: number;
    days?: number;
    subject?: string;
    message?: string;
    dryRun?: boolean;
  };

  const percentOff = Math.round(Number(b.percentOff));
  const days = Math.round(Number(b.days));
  if (!(percentOff >= 5 && percentOff <= 50)) {
    return NextResponse.json({ ok: false, error: "percentOff must be 5–50" }, { status: 400 });
  }
  if (!(days >= 1 && days <= 60)) {
    return NextResponse.json({ ok: false, error: "days must be 1–60" }, { status: 400 });
  }
  const subject = (b.subject || "").trim().slice(0, 120);
  const message = (b.message || "").trim().slice(0, 2000);
  if (!subject || !message) return NextResponse.json({ ok: false, error: "subject and message are required" }, { status: 400 });

  // One target per email (keep the first design as the one we link to).
  const byEmail = new Map<string, Target>();
  for (const tg of b.targets ?? []) {
    const e = (tg.email || "").trim().toLowerCase();
    if (e && !byEmail.has(e)) byEmail.set(e, { ...tg, email: e });
  }
  const emails = [...byEmail.keys()];
  if (emails.length === 0) return NextResponse.json({ ok: false, error: "no recipients" }, { status: 400 });
  if (emails.length > 200) return NextResponse.json({ ok: false, error: "max 200 recipients per send" }, { status: 400 });

  const contacts = new Map((await contactsByEmails(emails)).map((c) => [c.email, c]));
  const since = new Date(Date.now() - COOLDOWN_DAYS * 86400_000);
  const recent = db
    ? new Set(
        (
          await db
            .select({ email: marketingSends.email })
            .from(marketingSends)
            .where(and(inArray(marketingSends.email, emails), gte(marketingSends.createdAt, since)))
        ).map((r) => r.email),
      )
    : new Set<string>();

  const eligible: Target[] = [];
  const skipped: Array<{ email: string; reason: string }> = [];
  for (const e of emails) {
    const c = contacts.get(e);
    if (!c?.optIn || c.unsubscribedAt) skipped.push({ email: e, reason: "no_consent" });
    else if (recent.has(e)) skipped.push({ email: e, reason: "cooldown" });
    else eligible.push(byEmail.get(e)!);
  }

  if (b.dryRun) return NextResponse.json({ ok: true, eligible: eligible.map((x) => x.email), skipped });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ ok: false, error: "STRIPE_SECRET_KEY not set" }, { status: 503 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: false, error: "RESEND_API_KEY not set" }, { status: 503 });
  if (eligible.length === 0) return NextResponse.json({ ok: true, sent: [], failed: [], skipped });

  const stripe = new Stripe(stripeKey);
  const expiresAt = new Date(Date.now() + days * 86400_000);
  const coupon = await stripe.coupons.create({
    percent_off: percentOff,
    duration: "once",
    redeem_by: Math.floor(expiresAt.getTime() / 1000),
    name: `Wagamori ${percentOff}% OFF (${new Date().toISOString().slice(0, 10)})`,
    metadata: { source: "admin_leads" },
  });

  const me = await currentUser();
  const sentBy = me?.primaryEmailAddress?.emailAddress ?? me?.id ?? null;
  const sent: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];

  for (const tg of eligible) {
    const code = newPromoCode();
    try {
      const links = unsubscribeLinks(tg.email);
      if (!links) throw new Error("MARKETING_SECRET / CRON_SECRET not set (needed for unsubscribe links)");
      await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: coupon.id },
        code,
        max_redemptions: 1,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        metadata: { email: tg.email, designId: tg.designId ?? "" },
      });
      const ctaUrl = tg.designId ? `${SITE.url}/studio?design=${tg.designId}` : `${SITE.url}/studio`;
      const html = discountEmailHtml({
        message,
        code,
        percentOff,
        expiresAt,
        thumbUrl: tg.thumb,
        ctaUrl,
        unsubUrl: links.page,
      });
      const r = await sendMarketingMail(tg.email, subject, html, links.oneClick);
      if (!r.ok) throw new Error(r.error);
      sent.push(tg.email);
      await recordSend({ email: tg.email, userId: tg.userId ?? null, designId: tg.designId ?? null, promoCode: code, percentOff, expiresAt, sentBy });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      failed.push({ email: tg.email, error });
      await recordSend({
        email: tg.email,
        userId: tg.userId ?? null,
        designId: tg.designId ?? null,
        promoCode: code,
        percentOff,
        expiresAt,
        sentBy,
        status: "failed",
        error: error.slice(0, 500),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, sent, failed, skipped, coupon: coupon.id });
}
