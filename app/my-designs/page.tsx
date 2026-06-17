import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { listDesignsWithThumb } from "@/lib/db/designs";
import { getServerT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "My designs" };

export default async function MyDesignsPage() {
  const { t } = await getServerT();
  const { userId } = await auth();
  const designs = userId ? await listDesignsWithThumb(userId) : [];

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 md:py-14">
        <h1 className="font-display text-3xl">{t.myDesigns.title}</h1>

        {!userId ? (
          <div className="card mt-6 px-5 py-8 text-center">
            <p className="text-sm text-muted">{t.studio.edit.loginNote}</p>
            <SignInButton mode="modal">
              <button className="btn-primary mt-4 cursor-pointer rounded-full px-6 py-3 text-sm font-medium">
                {t.nav.login}
              </button>
            </SignInButton>
          </div>
        ) : designs.length === 0 ? (
          <div className="card mt-6 px-5 py-8 text-sm text-muted">{t.myDesigns.empty}</div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {designs.map((d) => (
              <Link key={d.id} href={`/my-designs/${d.id}`} className="group">
                <div className="card overflow-hidden p-2 transition group-hover:-translate-y-1 group-hover:shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.thumb ?? ""}
                    alt="design"
                    className="aspect-square w-full rounded-xl bg-blush/10 object-cover"
                  />
                </div>
                <p className="mt-1 text-center text-xs text-muted">
                  {d.count} {t.myDesigns.versions}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
