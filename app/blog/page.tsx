import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { listPublishedPosts } from "@/lib/db/posts";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "ブログ｜子供の絵・ペット写真を残すアイデア",
  description:
    "子供の絵やペットの写真を残す・飾る・形にするアイデア、出産祝いなどのギフト情報をお届けするわが守のブログ。",
  alternates: { canonical: `${SITE.url}/blog` },
  openGraph: { title: "わが守ブログ", url: `${SITE.url}/blog` },
};

export default async function BlogIndex() {
  const posts = await listPublishedPosts();
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 md:py-14">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-rose">JOURNAL</p>
          <h1 className="mt-2 font-display text-3xl md:text-4xl">ブログ</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
            子供の絵・ペットの写真を残すアイデア、ギフト選びのヒント。
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted">記事は準備中です。</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="group">
                <article className="card h-full overflow-hidden transition group-hover:-translate-y-1 group-hover:shadow-lg">
                  {p.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt={p.title} className="aspect-[16/10] w-full object-cover" />
                  )}
                  <div className="p-4">
                    <h2 className="font-display text-lg leading-snug">{p.title}</h2>
                    {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted">{p.excerpt}</p>}
                    {p.date && <p className="mt-3 text-xs text-muted">{p.date}</p>}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
