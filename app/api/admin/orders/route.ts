import { NextResponse } from "next/server";
import Stripe from "stripe";
import { canManage } from "@/lib/role";
import { effectiveStatus } from "@/lib/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shipTo(session: Stripe.Checkout.Session) {
  const s = session as unknown as {
    collected_information?: { shipping_details?: { name?: string; address?: Stripe.Address } };
    customer_details?: { name?: string; address?: Stripe.Address; phone?: string };
  };
  const ship = s.collected_information?.shipping_details ?? (s.customer_details?.address ? s.customer_details : undefined);
  const a = ship?.address;
  const phone = s.customer_details?.phone || "";
  if (!a) return { display: "", copy: "", phone };
  const display = [ship?.name, a.postal_code, a.state, a.city, a.line1, a.line2, a.country].filter(Boolean).join(" ");
  // Multi-line block for pasting into a shipping label (Japan-friendly).
  const copy = [
    ship?.name ? `${ship.name} 様` : "",
    a.postal_code ? `〒${a.postal_code}` : "",
    [a.state, a.city, a.line1, a.line2].filter(Boolean).join(""),
    a.country && a.country !== "JP" ? a.country : "",
    phone ? `TEL: ${phone}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { display, copy, phone };
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

  const data = res.data.map((s) => {
    const sm = (s.metadata ?? {}) as Record<string, string>;
    const pi = s.payment_intent && typeof s.payment_intent !== "string" ? s.payment_intent : null;
    const pm = (pi?.metadata ?? {}) as Record<string, string>;
    const status = effectiveStatus(pm.fulfillment || sm.fulfillment, pm.approval || sm.approval, pm.proofAt || sm.proofAt, now);
    const ship = shipTo(s);
    return {
      id: s.id,
      created: (s.created ?? 0) * 1000,
      email: s.customer_details?.email || s.customer_email || "",
      amount: s.amount_total ?? 0,
      paid: s.payment_status === "paid",
      status,
      tracking: pm.tracking || sm.tracking || "",
      approval: pm.approval || sm.approval || "",
      artwork: sm.artwork && sm.artwork.startsWith("http") ? sm.artwork : "",
      original: sm.original && sm.original.startsWith("http") ? sm.original : "",
      proof: pm.proof || sm.proof || "",
      spec: [sm.form || "necklace", sm.metal, sm.chain, sm.length, sm.engraving ? `“${sm.engraving}”` : ""].filter(Boolean).join(" · "),
      notes: sm.notes || "",
      address: ship.display,
      addressCopy: ship.copy,
      phone: ship.phone,
    };
  });

  return NextResponse.json({ ok: true, data });
}
