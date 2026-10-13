import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getServerT } from "@/lib/i18n-server";
import { verifyUnsubscribe } from "@/lib/marketing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string; done?: string }>;
}) {
  const { t } = await getServerT();
  const sp = await searchParams;
  const email = (sp.e || "").trim().toLowerCase();
  const valid = !!email && verifyUnsubscribe(email, sp.t || "");

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16 text-center md:py-24">
        <h1 className="font-display text-3xl">{t.unsubscribe.title}</h1>
        {sp.done ? (
          <p className="mt-4 text-muted">{t.unsubscribe.done}</p>
        ) : valid ? (
          // Unsubscribing needs an explicit click: link scanners that prefetch
          // the URL must never opt someone out.
          <form method="post" action={`/api/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(sp.t || "")}`} className="mt-6">
            <input type="hidden" name="from" value="page" />
            <p className="text-sm text-muted">{email}</p>
            <button type="submit" className="btn-primary mt-5 cursor-pointer rounded-full px-6 py-3 text-sm font-medium">
              {t.unsubscribe.confirm}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-muted">{t.unsubscribe.invalid}</p>
        )}
        <Link href="/" className="btn-ghost mt-10 inline-block rounded-full px-6 py-3 text-sm">
          {t.unsubscribe.back}
        </Link>
      </main>
      <Footer />
    </>
  );
}
