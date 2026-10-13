import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { SITE } from "./site";

// Marketing email helpers. 特定電子メール法 requires prior opt-in, the sender's
// identity, and a working opt-out in every message — all handled here.

function secret(): string | null {
  return process.env.MARKETING_SECRET || process.env.CRON_SECRET || process.env.ADMIN_TOKEN || null;
}

export function unsubscribeToken(email: string): string | null {
  const s = secret();
  if (!s) return null;
  return createHmac("sha256", s).update(email.toLowerCase()).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribe(email: string, token: string): boolean {
  const want = unsubscribeToken(email);
  if (!want || !token || want.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(want), Buffer.from(token));
}

/** `page` = human confirm page (footer link); `oneClick` = RFC 8058 POST endpoint (header). */
export function unsubscribeLinks(email: string): { page: string; oneClick: string } | null {
  const tok = unsubscribeToken(email);
  if (!tok) return null;
  const q = `e=${encodeURIComponent(email)}&t=${tok}`;
  return { page: `${SITE.url}/unsubscribe?${q}`, oneClick: `${SITE.url}/api/unsubscribe?${q}` };
}

/** Human-friendly single-use code, e.g. WG-7K3P-QX9M (no 0/O/1/I). */
export function newPromoCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(8);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `WG-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function discountEmailHtml(o: {
  message: string;
  code: string;
  percentOff: number;
  expiresAt: Date;
  thumbUrl?: string | null;
  ctaUrl: string;
  unsubUrl: string;
}): string {
  const until = o.expiresAt.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const paragraphs = esc(o.message)
    .split(/\n{2,}/)
    .map((p) => `<p style="color:#6b4a52;line-height:1.7;margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#4a2530">
    <p style="font-size:18px;letter-spacing:3px;color:#ca8a04;margin:0 0 16px">WAGAMORI</p>
    ${o.thumbUrl ? `<img src="${esc(o.thumbUrl)}" alt="" width="200" height="200" style="display:block;margin:0 auto 18px;border-radius:16px;object-fit:cover;background:#fdf6f3">` : ""}
    ${paragraphs}
    <div style="margin:18px 0;padding:16px;border:1px dashed #d2a235;border-radius:14px;text-align:center;background:#fffaf2">
      <p style="margin:0;font-size:13px;color:#9b7a80">${o.percentOff}%OFF クーポンコード</p>
      <p style="margin:6px 0 0;font-size:24px;font-weight:700;letter-spacing:2px;color:#4a2530">${esc(o.code)}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#9b7a80">有効期限：${until}まで ・ お一人さま1回限り<br>お支払い画面の「プロモーションコード」に入力してください</p>
    </div>
    <a href="${esc(o.ctaUrl)}" style="display:inline-block;background:#d2a235;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">デザインの続きを見る</a>
    <hr style="border:none;border-top:1px solid #f1ddd9;margin:28px 0 12px">
    <p style="font-size:11px;color:#9b7a80;line-height:1.6;margin:0">
      このメールは、Wagamori でお知らせの受け取りに同意いただいた方にお送りしています。<br>
      送信者：${SITE.name}（<a href="${SITE.url}/tokushoho" style="color:#ca8a04">特定商取引法に基づく表記・所在地</a>）<br>
      お問い合わせ：<a href="mailto:${SITE.email}" style="color:#ca8a04">${SITE.email}</a><br>
      配信停止：<a href="${esc(o.unsubUrl)}" style="color:#ca8a04">こちらから配信を停止できます</a>
    </p>
  </div>`;
}

export async function sendMarketingMail(to: string, subject: string, html: string, oneClickUrl: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false as const, error: "RESEND_API_KEY not set" };
  const from = process.env.EMAIL_FROM || "Wagamori <onboarding@resend.dev>";
  const res = await new Resend(key).emails.send({
    from,
    to,
    subject,
    html,
    replyTo: SITE.email,
    headers: {
      // RFC 8058 one-click unsubscribe (Gmail / Yahoo bulk-sender requirement).
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  if (res.error) return { ok: false as const, error: res.error.message };
  return { ok: true as const, id: res.data?.id ?? null };
}
