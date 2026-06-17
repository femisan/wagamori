"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "./LangProvider";

interface Post {
  id: string;
  imageUrl: string;
  caption: string | null;
  likes: number;
}

/**
 * Homepage buyer-show teaser. Fetches the latest customer photos client-side and
 * renders nothing until at least one exists, so the section stays hidden on a
 * fresh store and appears automatically once people start posting.
 */
export default function ShowcaseTeaser() {
  const { t } = useI18n();
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    let on = true;
    fetch("/api/showcase?limit=8")
      .then((r) => r.json())
      .then((j) => {
        if (on && j.ok && Array.isArray(j.data)) setPosts(j.data);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  if (posts.length === 0) return null;

  return (
    <section className="bg-surface/40 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-rose">{t.showcase.kicker}</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">{t.showcase.title}</h2>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {posts.slice(0, 8).map((p) => (
            <Link key={p.id} href="/showcase" className="group relative block">
              <div className="card overflow-hidden p-1.5 transition group-hover:-translate-y-1 group-hover:shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt={p.caption || "customer photo"}
                  className="aspect-square w-full rounded-xl object-cover"
                  loading="lazy"
                />
              </div>
              <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                {p.likes}
              </span>
            </Link>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/showcase" className="btn-ghost cursor-pointer rounded-full px-7 py-3 text-sm font-medium">
            {t.showcase.loadMore}
          </Link>
        </div>
      </div>
    </section>
  );
}
