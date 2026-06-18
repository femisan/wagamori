import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getPublishedPost } from "@/lib/db/posts";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Not found" };
  const url = `${SITE.url}/blog/${slug}`;
  return {
    title: post.title,
    description: post.description ?? post.excerpt ?? undefined,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description ?? undefined,
      url,
      type: "article",
      images: post.coverUrl ? [{ url: post.coverUrl }] : undefined,
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const url = `${SITE.url}/blog/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description ?? post.excerpt ?? undefined,
    datePublished: post.date ?? undefined,
    image: post.coverUrl ?? undefined,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
  };

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 md:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Link href="/blog" className="text-sm text-muted transition-colors hover:text-foreground">
          ← ブログ一覧
        </Link>
        <h1 className="mt-4 font-display text-3xl leading-tight md:text-4xl">{post.title}</h1>
        {post.date && <p className="mt-2 text-xs text-muted">{post.date}</p>}
        {post.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverUrl} alt={post.title} className="mt-6 w-full rounded-2xl object-cover" />
        )}
        <article className="article mt-8" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
      </main>
      <Footer />
    </>
  );
}
