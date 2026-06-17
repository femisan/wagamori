import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReorderButton from "@/components/ReorderButton";
import { listOrdersByUser } from "@/lib/db/designs";
import { formatPrice } from "@/lib/products";
import { getServerT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "My orders" };

const STATUS_KEYS = ["received", "proof", "crafting", "shipped"] as const;

export default async function MyOrdersPage() {
  const { t } = await getServerT();
  const { userId } = await auth();
  const orders = userId ? await listOrdersByUser(userId) : [];

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 md:py-14">
        <h1 className="font-display text-3xl">{t.myOrders.title}</h1>
        <p className="mt-2 text-sm text-muted">{t.myOrders.intro}</p>

        {!userId ? (
          <div className="card mt-6 px-5 py-8 text-center">
            <p className="text-sm text-muted">{t.myOrders.loginNote}</p>
            <SignInButton mode="modal">
              <button className="btn-primary mt-4 cursor-pointer rounded-full px-6 py-3 text-sm font-medium">
                {t.nav.login}
              </button>
            </SignInButton>
          </div>
        ) : orders.length === 0 ? (
          <div className="card mt-6 px-5 py-8 text-center text-sm text-muted">
            {t.myOrders.empty}
            <div className="mt-4">
              <Link href="/studio" className="btn-primary inline-block cursor-pointer rounded-full px-6 py-3 text-sm font-medium">
                {t.nav.tryFree}
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {orders.map((o) => {
              const spec = parseSpec(o.spec);
              const metalLabel = spec.metal
                ? t.product.metals[spec.metal as keyof typeof t.product.metals]?.label ?? spec.metal
                : "";
              const statusIdx = Math.max(0, STATUS_KEYS.indexOf(o.status as (typeof STATUS_KEYS)[number]));
              const statusLabel = t.track.stages[statusIdx]?.t ?? o.status;
              return (
                <div key={o.id} className="card flex gap-4 p-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-blush/10">
                    {o.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.artworkUrl} alt="order" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {metalLabel}
                          {spec.engraving ? ` ・ "${spec.engraving}"` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {new Date(o.createdAt).toLocaleDateString("ja-JP")} ・ {statusLabel}
                        </p>
                      </div>
                      {o.amountJpy != null && (
                        <span className="shrink-0 font-display text-lg">{formatPrice(o.amountJpy)}</span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {o.stripeSessionId && (
                        <Link
                          href={`/track?id=${encodeURIComponent(o.stripeSessionId)}`}
                          className="btn-ghost cursor-pointer rounded-full px-4 py-2 text-xs"
                        >
                          {t.myOrders.track}
                        </Link>
                      )}
                      <ReorderButton orderId={o.id} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

function parseSpec(spec: string | null): { metal?: string; engraving?: string } {
  if (!spec) return {};
  try {
    return JSON.parse(spec);
  } catch {
    return {};
  }
}
