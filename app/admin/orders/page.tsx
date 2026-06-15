import Stripe from "stripe";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminStatusForm from "@/components/AdminStatusForm";
import { formatPrice } from "@/lib/products";
import { getServerT } from "@/lib/i18n-server";
import { effectiveStatus } from "@/lib/fulfillment";

// Live data + secret token check → never cache.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Orders" };

interface Addr {
  name?: string;
  lines: string[];
}

/** Pull a shipping address out of a session across Stripe API versions. */
function extractAddress(session: Stripe.Checkout.Session): Addr | null {
  // Newer API: collected_information.shipping_details; older: shipping_details.
  const s = session as unknown as {
    collected_information?: { shipping_details?: { name?: string; address?: Stripe.Address } };
    shipping_details?: { name?: string; address?: Stripe.Address };
    customer_details?: { name?: string; address?: Stripe.Address };
  };
  const ship =
    s.collected_information?.shipping_details ??
    s.shipping_details ??
    (s.customer_details?.address ? s.customer_details : undefined);
  const a = ship?.address;
  if (!a) return null;
  const lines = [
    [a.postal_code, a.state, a.city].filter(Boolean).join(" "),
    [a.line1, a.line2].filter(Boolean).join(" "),
    a.country ?? "",
  ].filter((x): x is string => Boolean(x));
  return { name: ship?.name ?? undefined, lines };
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { t } = await getServerT();
  const { token } = await searchParams;
  const adminToken = process.env.ADMIN_TOKEN;
  const secret = process.env.STRIPE_SECRET_KEY;

  // Gate: require the admin token (when one is configured).
  const authed = adminToken ? token === adminToken : false;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 md:py-14">
        <h1 className="font-display text-3xl">{t.admin.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t.admin.intro}</p>

        {!authed ? (
          <div className="card mt-8 px-5 py-6 text-sm text-muted">{t.admin.locked}</div>
        ) : !secret ? (
          <div className="card mt-8 px-5 py-6 text-sm text-muted">
            STRIPE_SECRET_KEY is not set — no live orders to show.
          </div>
        ) : (
          <OrderList secret={secret} token={token!} t={t} />
        )}
      </main>
      <Footer />
    </>
  );
}

async function OrderList({
  secret,
  token,
  t,
}: {
  secret: string;
  token: string;
  t: Awaited<ReturnType<typeof getServerT>>["t"];
}) {
  const stripe = new Stripe(secret);
  let sessions: Stripe.Checkout.Session[] = [];
  try {
    const res = await stripe.checkout.sessions.list({
      limit: 50,
      expand: ["data.customer_details", "data.payment_intent"],
    });
    sessions = res.data;
  } catch (err) {
    return (
      <div className="card mt-8 px-5 py-6 text-sm text-blush-deep">
        {err instanceof Error ? err.message : "Failed to load orders."}
      </div>
    );
  }

  if (sessions.length === 0) {
    return <div className="card mt-8 px-5 py-6 text-sm text-muted">{t.admin.none}</div>;
  }

  return (
    <div className="mt-8 space-y-4">
      {sessions.map((s) => {
        const m = (s.metadata ?? {}) as Record<string, string>;
        const pi = s.payment_intent && typeof s.payment_intent !== "string" ? s.payment_intent : null;
        const pm = (pi?.metadata ?? {}) as Record<string, string>;
        const addr = extractAddress(s);
        const artwork = m.artwork && m.artwork.startsWith("http") ? m.artwork : null;
        const original = m.original && m.original.startsWith("http") ? m.original : null;
        const rawStatus = pm.fulfillment || m.fulfillment || "received";
        const approvalVal = pm.approval || m.approval || "";
        const proofAt = pm.proofAt || m.proofAt || "";
        const status = effectiveStatus(rawStatus, approvalVal, proofAt, Date.now());
        const trackingNo = pm.tracking || m.tracking || "";
        const proofUrl = pm.proof || m.proof || "";
        const feedback = pm.feedback || m.feedback || "";
        const approved = approvalVal === "approved" || approvalVal === "auto";
        const paid = s.payment_status === "paid";
        const spec = [
          m.style,
          m.metal,
          m.chain,
          m.length,
          m.engraving ? `“${m.engraving}”` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        const email = s.customer_details?.email ?? s.customer_email ?? "—";

        return (
          <article key={s.id} className="card grid gap-4 p-5 sm:grid-cols-[120px_1fr]">
            {/* Artwork */}
            <div>
              {artwork ? (
                <a href={artwork} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={artwork}
                    alt="Order artwork"
                    className="aspect-square w-full rounded-xl object-cover ring-1 ring-line"
                  />
                  <span className="mt-1 block text-center text-xs text-rose underline">
                    {t.admin.download}
                  </span>
                </a>
              ) : (
                <div className="grid aspect-square w-full place-items-center rounded-xl bg-blush/20 text-center text-[11px] text-muted">
                  {m.artwork || "—"}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    paid ? "bg-green-100 text-green-800" : "bg-blush/30 text-foreground/70"
                  }`}
                >
                  {paid ? t.admin.paid : t.admin.unpaid}
                </span>
                <span className="font-display text-lg">
                  {s.amount_total != null ? formatPrice(s.amount_total) : "—"}
                </span>
                <span className="text-muted">{email}</span>
                <span className="ml-auto font-mono text-xs text-muted">{s.id.slice(0, 18)}…</span>
              </div>

              <p className="mt-3">
                <span className="text-muted">{t.admin.customization}: </span>
                {spec || "—"}
              </p>
              {m.notes && <p className="mt-1 text-muted">“{m.notes}”</p>}

              <div className="mt-3">
                <span className="text-muted">{t.admin.address}: </span>
                {addr ? (
                  <span>
                    {addr.name ? `${addr.name} / ` : ""}
                    {addr.lines.join(", ")}
                  </span>
                ) : (
                  <span className="text-muted">{t.admin.noAddress}</span>
                )}
              </div>

              {original && (
                <a
                  href={original}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-rose underline"
                >
                  {t.admin.viewOriginal}
                </a>
              )}

              <AdminStatusForm
                token={token}
                sessionId={s.id}
                initialStatus={status}
                initialTracking={trackingNo}
                proof={proofUrl}
                feedback={feedback}
                approved={approved}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
