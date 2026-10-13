import "server-only";
import type Stripe from "stripe";
import { SITE } from "./site";
import { emailShell, sendMail } from "./mail";
import { getDict, isLocale, defaultLocale } from "./i18n";
import { itemsByOrder } from "./db/designs";

// Designer handoff for orders where the customer stopped the AI preview and
// asked for a human designer. After payment: the designer gets the brief +
// every reference image, and the customer learns how to reach the designer.
// The designer then uploads a proof through the existing admin proof flow.

/** How a customer reaches the designer — email only. */
export function designerContact() {
  return { email: SITE.email };
}

type HandoffItem = { artwork: string; original: string; spec: string; brief: string; human: boolean };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const http = (u?: string | null) => (u && u.startsWith("http") ? u : "");

async function handoffItems(m: Record<string, string>): Promise<HandoffItem[]> {
  if (m.orderId) {
    const rows = (await itemsByOrder([m.orderId]).catch(() => new Map())).get(m.orderId) ?? [];
    if (rows.length) {
      return rows.map((r: { artworkUrl: string | null; originalUrl: string | null; form: string | null; metal: string | null; engraving: string | null; designBrief: string | null; designMode: string }) => ({
        artwork: http(r.artworkUrl),
        original: http(r.originalUrl),
        spec: [r.form, r.metal, r.engraving ? `刻印「${r.engraving}」` : ""].filter(Boolean).join(" · "),
        brief: r.designBrief || "",
        human: r.designMode === "human",
      }));
    }
  }
  const out: HandoffItem[] = [];
  for (let i = 0; i < 30 && m[`item${i}`]; i++) {
    try {
      const j = JSON.parse(m[`item${i}`]) as Record<string, string | number>;
      out.push({
        artwork: http(String(j.a ?? "")),
        original: http(String(j.o ?? "")),
        spec: [j.f, j.m, j.e ? `刻印「${j.e}」` : ""].filter(Boolean).join(" · "),
        brief: String(j.b ?? ""),
        human: j.h === 1,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function sendDesignerHandoff(session: Stripe.Checkout.Session) {
  const m = (session.metadata ?? {}) as Record<string, string>;
  if (m.human !== "1") return;
  const customer = session.customer_details?.email || session.customer_email || "";
  const items = (await handoffItems(m)).filter((i) => i.human);
  const trackUrl = `${SITE.url}/track?id=${encodeURIComponent(session.id)}`;

  // 1) Designer: brief + reference images, so work can start right away.
  const designerTo = process.env.SELLER_EMAIL || SITE.email;
  const rows = items
    .map(
      (it, i) => `
      <div style="border:1px solid #f1ddd9;border-radius:12px;padding:12px;margin:0 0 12px">
        <p style="margin:0 0 6px;font-weight:600">#${i + 1} ${esc(it.spec)}</p>
        <p style="margin:0 0 8px;white-space:pre-wrap;color:#4a2530">${esc(it.brief || "（要望の記入なし）")}</p>
        ${it.original ? `<a href="${it.original}"><img src="${it.original}" width="120" style="border-radius:8px;margin-right:8px" alt="元写真"></a>` : ""}
        ${it.artwork ? `<a href="${it.artwork}"><img src="${it.artwork}" width="120" style="border-radius:8px" alt="参考にしたAI案"></a>` : ""}
        <p style="margin:6px 0 0;font-size:12px;color:#9b7a80">左：元写真（原件） ${it.artwork ? "／ 右：お客様が選んだAI案（参考）" : ""}</p>
      </div>`,
    )
    .join("");
  await sendMail(
    designerTo,
    `【人工デザイン依頼】${customer || session.id}`,
    `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#4a2530">
      <h1 style="font-size:20px;margin:0 0 8px">デザイナー仕上げのご注文が入りました</h1>
      <p style="color:#6b4a52;margin:0 0 4px">お客様：${esc(customer || "—")}</p>
      <p style="color:#6b4a52;margin:0 0 16px">注文ID：${session.id}</p>
      ${rows || "<p>アイテム情報を取得できませんでした。管理画面で確認してください。</p>"}
      <p style="font-size:13px;color:#6b4a52">お客様に連絡し、デザインができたら管理画面「注文管理」から校正をアップしてください（お客様が追跡ページで承認します）。</p>
      <a href="${SITE.url}/admin/orders" style="display:inline-block;background:#d2a235;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600">注文管理を開く</a>
    </div>`,
  );

  // 2) Customer: who is designing it and how to talk to them.
  if (!customer) return;
  const locale = isLocale(m.locale) ? m.locale : defaultLocale;
  const t = getDict(locale).email;
  const { email } = designerContact();
  const how = `${t.designerBody}<br><br>${t.designerReply.replace(
    "{email}",
    `<a href="mailto:${email}" style="color:#ca8a04">${email}</a>`,
  )}`;
  await sendMail(
    customer,
    t.designerSubject,
    emailShell({ heading: t.designerHeading, body: how, ctaLabel: t.cta, ctaUrl: trackUrl }),
  );
}
