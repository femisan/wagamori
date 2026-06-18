import Stripe from "stripe";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ShareCard from "@/components/ShareCard";
import ProofApproval from "@/components/ProofApproval";
import { effectiveStatus, hoursLeft } from "@/lib/fulfillment";
import { formatPrice } from "@/lib/products";
import { getServerT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Track order" };

const STAGE_ORDER = ["received", "proof", "crafting", "shipped"] as const;

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { t } = await getServerT();
  const { id } = await searchParams;
  const secret = process.env.STRIPE_SECRET_KEY;

  let session: Stripe.Checkout.Session | null = null;
  let notFound = false;
  if (id && secret) {
    try {
      const stripe = new Stripe(secret);
      session = await stripe.checkout.sessions.retrieve(id, {
        expand: ["payment_intent", "customer_details"],
      });
    } catch {
      notFound = true;
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 md:py-14">
        <h1 className="font-display text-3xl">{t.track.title}</h1>
        <p className="mt-2 text-sm text-muted">{t.track.intro}</p>

        {/* Lookup form */}
        <form method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            name="id"
            defaultValue={id ?? ""}
            placeholder={t.track.placeholder}
            aria-label={t.track.inputLabel}
            className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-gold"
          />
          <button type="submit" className="btn-primary cursor-pointer rounded-full px-6 py-3 text-sm font-medium">
            {t.track.submit}
          </button>
        </form>

        {id && (notFound || !session) && (
          <div className="card mt-6 px-5 py-6 text-sm text-muted">{t.track.notFound}</div>
        )}

        {session && <OrderStatus session={session} t={t} />}
      </main>
      <Footer />
    </>
  );
}

async function OrderStatus({
  session,
  t,
}: {
  session: Stripe.Checkout.Session;
  t: Awaited<ReturnType<typeof getServerT>>["t"];
}) {
  const sm = (session.metadata ?? {}) as Record<string, string>;
  const pi = (session.payment_intent && typeof session.payment_intent !== "string"
    ? session.payment_intent
    : null) as Stripe.PaymentIntent | null;
  const pm = (pi?.metadata ?? {}) as Record<string, string>;

  // Seller-set status; auto-advance past the proof window so it never gets stuck.
  const rawStatus = pm.fulfillment || sm.fulfillment || "received";
  const approval = pm.approval || sm.approval || "";
  const proofAt = pm.proofAt || sm.proofAt || "";
  // eslint-disable-next-line react-hooks/purity -- server component, per-request time is intended
  const now = Date.now();
  const statusKey = effectiveStatus(rawStatus, approval, proofAt, now);
  const trackingNo = pm.tracking || sm.tracking || "";
  const currentIndex = Math.max(0, STAGE_ORDER.indexOf(statusKey as (typeof STAGE_ORDER)[number]));

  const proofUrl = (pm.proof || sm.proof || "").startsWith("http") ? pm.proof || sm.proof : "";
  const showProof = statusKey === "proof" && proofUrl && approval !== "approved";
  const hLeft = hoursLeft(proofAt, now);

  // Pass the small blob URLs to the client — it fetches + composes there.
  const previewUrl = sm.artwork && sm.artwork.startsWith("http") ? sm.artwork : undefined;
  const originalUrl = sm.original && sm.original.startsWith("http") ? sm.original : undefined;

  const formLabel = sm.form
    ? t.product.forms?.[sm.form as keyof typeof t.product.forms]?.label ?? sm.form
    : t.studio.summary.itemValue;
  const summary = [
    [t.studio.summary.item, formLabel],
    [t.studio.summary.metal, sm.metal ? t.product.metals[sm.metal as keyof typeof t.product.metals]?.label ?? sm.metal : null],
    [t.studio.summary.chain, sm.form === "necklace" || !sm.form ? sm.length || null : null],
    [t.studio.summary.engraving, sm.engraving ? `“${sm.engraving}”` : null],
  ].filter((r) => r[1]) as [string, string][];

  const addr = extractAddress(session);

  return (
    <div className="mt-8 space-y-6">
      {/* Status timeline */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">{t.track.statusTitle}</h2>
          <span className="font-mono text-xs text-muted">{session.id.slice(0, 20)}…</span>
        </div>
        <ol className="mt-5 space-y-4">
          {t.track.stages.map((stage, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <li key={stage.key} className="flex gap-3">
                <span
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${
                    done || active ? "btn-primary" : "border border-line text-muted"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <div className={active ? "" : done ? "opacity-90" : "opacity-45"}>
                  <p className="font-medium">{stage.t}</p>
                  <p className="text-sm text-muted">{stage.d}</p>
                  {stage.key === "shipped" && active && trackingNo && (
                    <p className="mt-1 text-sm">
                      {t.track.tracking}: <span className="font-mono">{trackingNo}</span>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Design proof — review & approve */}
      {showProof && (
        <section className="card border-rose/40 p-5">
          <h2 className="font-display text-xl">{t.track.proof.title}</h2>
          <p className="mt-1 text-sm text-muted">{t.track.proof.intro}</p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-blush/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={proofUrl} alt="Final design proof" className="mx-auto block max-h-[420px] w-auto" />
          </div>
          <ProofApproval sessionId={session.id} />
          {hLeft > 0 && (
            <p className="mt-3 text-center text-xs text-muted">
              {t.track.proof.autoNote.replace("{h}", String(hLeft))}
            </p>
          )}
        </section>
      )}

      {/* Order summary + address */}
      {(summary.length > 0 || addr) && (
        <section className="card p-5">
          <h2 className="font-display text-xl">{t.track.summaryTitle}</h2>
          <div className="mt-3 divide-y divide-line text-sm">
            {summary.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2">
                <span className="text-muted">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
            {session.amount_total != null && (
              <div className="flex items-center justify-between py-2">
                <span className="text-muted">{t.success.total}</span>
                <span className="font-display text-lg">{formatPrice(session.amount_total)}</span>
              </div>
            )}
            {addr && (
              <div className="py-2">
                <span className="text-muted">{t.track.shipTo}: </span>
                {addr.name ? `${addr.name} / ` : ""}
                {addr.lines.join(", ")}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Shareable sample */}
      {previewUrl && (
        <ShareCard preview={previewUrl} original={originalUrl} engraving={sm.engraving || undefined} />
      )}
    </div>
  );
}

interface Addr {
  name?: string;
  lines: string[];
}
function extractAddress(session: Stripe.Checkout.Session): Addr | null {
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
