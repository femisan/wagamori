import "server-only";
import { Resend } from "resend";
import { SITE } from "./site";

/** Best-effort transactional email via Resend. No-ops if RESEND_API_KEY is unset. */
export async function sendMail(to: string | undefined | null, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  const from = process.env.EMAIL_FROM || "Wagamori <onboarding@resend.dev>";
  try {
    // Send FROM the verified domain (deliverability); replies go to the inbox
    // we actually monitor (SITE.email — the Gmail).
    await new Resend(key).emails.send({ from, to, subject, html, replyTo: SITE.email });
  } catch {
    // swallow — email is never allowed to break the request flow
  }
}

/** Branded email body matching the site (Rose & Gold). */
export function emailShell(opts: {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  const btn =
    opts.ctaUrl && opts.ctaLabel
      ? `<a href="${opts.ctaUrl}" style="display:inline-block;background:#d2a235;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${opts.ctaLabel}</a>
         <p style="font-size:12px;color:#9b7a80;margin:24px 0 0;word-break:break-all">${opts.ctaUrl}</p>`
      : "";
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#4a2530">
    <p style="font-size:18px;letter-spacing:3px;color:#ca8a04;margin:0 0 16px">WAGAMORI</p>
    <h1 style="font-size:22px;margin:0 0 8px">${opts.heading}</h1>
    <p style="color:#9b7a80;line-height:1.6;margin:0 0 20px">${opts.body}</p>
    ${btn}
    <p style="font-size:12px;color:#9b7a80;margin:20px 0 0">お問い合わせ / Contact: <a href="mailto:${SITE.email}" style="color:#ca8a04">${SITE.email}</a></p>
    ${opts.footer ? `<p style="font-size:12px;color:#c9b8bc;margin:8px 0 0">${opts.footer}</p>` : ""}
  </div>`;
}
