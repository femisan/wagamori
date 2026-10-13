import type Stripe from "stripe";

/** Shipping name/address/phone from a Checkout session, as display + label-ready text. */
export function shipTo(session: Stripe.Checkout.Session) {
  const s = session as unknown as {
    collected_information?: { shipping_details?: { name?: string; address?: Stripe.Address } };
    customer_details?: { name?: string; address?: Stripe.Address; phone?: string };
  };
  const ship = s.collected_information?.shipping_details ?? (s.customer_details?.address ? s.customer_details : undefined);
  const a = ship?.address;
  const phone = s.customer_details?.phone || "";
  const name = ship?.name || "";
  if (!a) return { name, display: "", copy: "", phone };
  const display = [name, a.postal_code, a.state, a.city, a.line1, a.line2, a.country].filter(Boolean).join(" ");
  // Multi-line block for pasting into a shipping label (Japan-friendly).
  const copy = [
    name ? `${name} 様` : "",
    a.postal_code ? `〒${a.postal_code}` : "",
    [a.state, a.city, a.line1, a.line2].filter(Boolean).join(""),
    a.country && a.country !== "JP" ? a.country : "",
    phone ? `TEL: ${phone}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { name, display, copy, phone };
}

/** Promotion code used on a session (code text if expanded, else the promo id). */
export function promoCodeOf(session: Stripe.Checkout.Session): string | null {
  const d = (session as unknown as { discounts?: Array<{ promotion_code?: string | { code?: string } | null }> })
    .discounts?.[0]?.promotion_code;
  if (!d) return null;
  return typeof d === "string" ? d : d.code ?? null;
}
