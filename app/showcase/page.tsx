import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ShowcaseBoard from "@/components/ShowcaseBoard";
import { listShowcase } from "@/lib/db/showcase";
import { getServerT } from "@/lib/i18n-server";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return {
    title: t.showcase.metaTitle,
    description: t.showcase.metaDescription,
    alternates: { canonical: `${SITE.url}/showcase` },
    openGraph: { title: t.showcase.metaTitle, description: t.showcase.metaDescription, url: `${SITE.url}/showcase` },
  };
}

export default async function ShowcasePage() {
  const { t } = await getServerT();
  const rows = await listShowcase(24, 0);
  const initial = rows.map((r) => ({
    id: r.id,
    imageUrl: r.imageUrl,
    sourceUrl: r.sourceUrl,
    caption: r.caption,
    authorName: r.authorName,
    likes: r.likes,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 md:py-14">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">{t.showcase.kicker}</p>
          <h1 className="mt-2 font-display text-3xl md:text-4xl">{t.showcase.title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{t.showcase.sub}</p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-foreground/70">{t.showcase.intro}</p>
        </div>
        <div className="mt-8">
          <ShowcaseBoard initial={initial} />
        </div>
      </main>
      <Footer />
    </>
  );
}
