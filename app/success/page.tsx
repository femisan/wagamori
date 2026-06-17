import Link from "next/link";
import Stripe from "stripe";
import QRCode from "qrcode";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CopyButton from "@/components/CopyButton";
import { formatPrice } from "@/lib/products";
import { SITE } from "@/lib/site";
import { getServerT } from "@/lib/i18n-server";
import { recordOrderFromSession } from "@/lib/order-record";

export const metadata = { title: "Order confirmed" };
export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; amount?: string; desc?: string; session_id?: string }>;
}) {
  const sp = await searchParams;
  const { t } = await getServerT();
  const isDemo = sp.demo === "1";
  const amount = sp.amount ? Number(sp.amount) : null;

  // Record the order to the buyer's history (no-op for guests / no DB).
  const secret = process.env.STRIPE_SECRET_KEY;
  if (sp.session_id && secret) {
    try {
      const stripe = new Stripe(secret);
      const session = await stripe.checkout.sessions.retrieve(sp.session_id, {
        expand: ["customer_details"],
      });
      await recordOrderFromSession(session);
    } catch {
      /* non-blocking — the confirmation page still renders */
    }
  }

  // Build the absolute tracking URL + a QR code so the customer can save it.
  const trackUrl = sp.session_id
    ? `${SITE.url}/track?id=${encodeURIComponent(sp.session_id)}`
    : null;
  let qrDataUrl: string | null = null;
  if (trackUrl) {
    try {
      qrDataUrl = await QRCode.toDataURL(trackUrl, { margin: 1, width: 320 });
    } catch {
      qrDataUrl = null;
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-5 py-16 text-center md:py-24">
        <div className="animate-floaty grid h-20 w-20 place-items-center rounded-full bg-rose/15">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="1.8">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 className="mt-6 font-display text-4xl">{t.success.title}</h1>
        <p className="mt-3 max-w-md text-muted">{isDemo ? t.success.demo : t.success.real}</p>

        {amount != null && (
          <div className="card mt-6 w-full max-w-sm px-5 py-4 text-left text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">{t.success.total}</span>
              <span className="font-display text-lg">{formatPrice(amount)}</span>
            </div>
            {sp.desc && <p className="mt-2 text-muted">{sp.desc}</p>}
          </div>
        )}

        <ol className="mt-8 w-full max-w-sm space-y-3 text-left text-sm">
          {t.success.steps.map((s, i) => (
            <Stepline key={s.t} n={i + 1} title={s.t} desc={s.d} />
          ))}
        </ol>

        {sp.session_id && trackUrl && (
          <div className="card mt-8 w-full max-w-sm px-5 py-5 text-left text-sm">
            <p className="text-muted">{t.success.orderId}</p>
            <p className="mt-1 break-all font-mono text-xs">{sp.session_id}</p>

            <p className="mt-3 rounded-lg bg-blush/20 px-3 py-2 text-xs text-foreground/80">
              {t.success.saveHint}
            </p>

            {qrDataUrl && (
              <div className="mt-4 flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="Order tracking QR code"
                  className="h-40 w-40 rounded-xl border border-line bg-white p-2"
                />
                <span className="mt-1 text-xs text-muted">{t.success.scan}</span>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Link
                href={`/track?id=${encodeURIComponent(sp.session_id)}`}
                className="btn-primary inline-block cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium"
              >
                {t.success.trackCta}
              </Link>
              <CopyButton text={trackUrl} />
            </div>
          </div>
        )}

        <Link href="/" className="btn-ghost mt-10 rounded-full px-6 py-3 text-sm">
          {t.success.back}
        </Link>
      </main>
      <Footer />
    </>
  );
}

function Stepline({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <span className="btn-primary grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs">{n}</span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted">{desc}</p>
      </div>
    </li>
  );
}
