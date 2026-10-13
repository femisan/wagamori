import { NextResponse } from "next/server";
import Stripe from "stripe";
import { canManage } from "@/lib/role";
import { effectiveStatus } from "@/lib/fulfillment";
import { shipTo } from "@/lib/shipping";
import { itemsByOrder, ordersBySessionIds } from "@/lib/db/designs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = {
  artwork: string;
  original: string;
  metal: string;
  form: string;
  engraving: string;
  notes: string;
  price: number | null;
  designId: string;
  designMode: "ai" | "human";
  brief: string;
};

const http = (u?: string | null) => (u && u.startsWith("http") ? u : "");

/** Items from Stripe metadata — fallback when the DB row is missing (old orders / no DB). */
function itemsFromMetadata(sm: Record<string, string>): Item[] {
  const out: Item[] = [];
  for (let i = 0; i < 30; i++) {
    const raw = sm[`item${i}`];
    if (!raw) break;
    try {
      const j = JSON.parse(raw) as Record<string, string | number>;
      const str = (k: string) => String(j[k] ?? "");
      out.push({
        artwork: http(str("a")),
        original: http(str("o")),
        metal: str("m"),
        form: str("f"),
        engraving: str("e"),
        notes: "",
        price: null,
        designId: str("d"),
        designMode: j.h === 1 ? "human" : "ai",
        brief: str("b"),
      });
    } catch {
      /* skip */
    }
  }
  if (out.length) return out;
  // Legacy single-item sessions.
  return [
    {
      artwork: http(sm.artwork),
      original: http(sm.original),
      metal: sm.metal || "",
      form: sm.form || "necklace",
      engraving: sm.engraving || "",
      notes: sm.notes || "",
      price: null,
      designId: "",
      designMode: "ai",
      brief: "",
    },
  ];
}

export async function GET() {
  if (!(await canManage())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return NextResponse.json({ ok: true, data: [] });

  const stripe = new Stripe(secret);
  const res = await stripe.checkout.sessions.list({ limit: 100, expand: ["data.payment_intent", "data.customer_details"] });
  const now = Date.now();

  // Enrich with the DB order + items (source of truth for what to produce).
  const dbOrders = await ordersBySessionIds(res.data.map((s) => s.id)).catch(() => []);
  const orderBySession = new Map(dbOrders.map((o) => [o.stripeSessionId, o]));
  const items = await itemsByOrder(dbOrders.map((o) => o.id)).catch(() => new Map());

  const data = res.data.map((s) => {
    const sm = (s.metadata ?? {}) as Record<string, string>;
    const pi = s.payment_intent && typeof s.payment_intent !== "string" ? s.payment_intent : null;
    const pm = (pi?.metadata ?? {}) as Record<string, string>;
    const status = effectiveStatus(pm.fulfillment || sm.fulfillment, pm.approval || sm.approval, pm.proofAt || sm.proofAt, now);
    const ship = shipTo(s);
    const order = orderBySession.get(s.id);
    const dbItems = order ? items.get(order.id) ?? [] : [];
    const list: Item[] = dbItems.length
      ? dbItems.map((it: { artworkUrl: string | null; originalUrl: string | null; metal: string | null; form: string | null; engraving: string | null; notes: string | null; priceJpy: number | null; designId: string | null; designMode: string; designBrief: string | null }) => ({
          artwork: http(it.artworkUrl),
          original: http(it.originalUrl),
          metal: it.metal || "",
          form: it.form || "",
          engraving: it.engraving || "",
          notes: it.notes || "",
          price: it.priceJpy,
          designId: it.designId || "",
          designMode: it.designMode === "human" ? ("human" as const) : ("ai" as const),
          brief: it.designBrief || "",
        }))
      : itemsFromMetadata(sm);
    const discount = (s.total_details?.amount_discount ?? 0) as number;
    return {
      id: s.id,
      orderId: order?.id ?? sm.orderId ?? "",
      created: (s.created ?? 0) * 1000,
      email: s.customer_details?.email || s.customer_email || "",
      amount: s.amount_total ?? 0,
      discount,
      promoCode: order?.promoCode ?? "",
      paid: s.payment_status === "paid",
      status,
      tracking: pm.tracking || sm.tracking || "",
      approval: pm.approval || sm.approval || "",
      proof: pm.proof || sm.proof || "",
      items: list,
      human: list.some((i) => i.designMode === "human"),
      notes: sm.notes || list.find((i) => i.notes)?.notes || "",
      address: ship.display,
      addressCopy: ship.copy,
      phone: ship.phone,
    };
  });

  return NextResponse.json({ ok: true, data });
}
