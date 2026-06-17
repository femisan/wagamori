"use client";

import { useState } from "react";
import Link from "next/link";
import NecklacePreviewCard from "./NecklacePreviewCard";
import { useI18n } from "./LangProvider";

export default function Hero() {
  const { t } = useI18n();
  const [videoOpen, setVideoOpen] = useState(false);
  // Optional: set NEXT_PUBLIC_HERO_VIDEO to a YouTube embed or .mp4 URL.
  const videoUrl = process.env.NEXT_PUBLIC_HERO_VIDEO || "";

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-10 pt-12 md:grid-cols-2 md:pt-20">
        {/* Copy */}
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--rose)" }} />
            {t.hero.badge}
          </span>

          <h1 className="mt-5 font-display text-[2.6rem] leading-[1.05] sm:text-6xl">
            {t.hero.title1}
            <br />
            {t.hero.title2}
            <br />
            <span className="text-rose-grad italic">{t.hero.titleHighlight}</span>
          </h1>

          <p className="mt-4 font-display text-lg italic text-foreground/70">{t.hero.tagline}</p>

          <p className="mt-4 max-w-md text-lg text-muted">{t.hero.subtitle}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/studio" className="btn-primary cursor-pointer rounded-full px-7 py-3.5 text-base font-medium">
              {t.hero.ctaPrimary}
            </Link>
            {/* "Watch how it works" — hidden until a brand video is configured
                (set NEXT_PUBLIC_HERO_VIDEO to bring it back automatically). */}
            {videoUrl && (
              <button
                onClick={() => setVideoOpen(true)}
                className="btn-ghost inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-3.5 text-sm"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-rose/15">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="var(--rose)">
                    <path d="M2 1.5v9l8-4.5z" />
                  </svg>
                </span>
                {t.hero.ctaVideo}
              </button>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span>✓ {t.trust.handmade}</span>
            <span>✓ {t.trust.shipping}</span>
            <span>✓ {t.trust.hypo}</span>
          </div>
        </div>

        {/* Visual */}
        <div className="relative animate-fade-up [animation-delay:120ms]">
          <div className="absolute inset-0 -z-10 mx-auto h-72 w-72 translate-y-6 rounded-full bg-blush/40 blur-3xl" />
          <NecklacePreviewCard src="/gallery/hero.jpg" metal="gold" engraving={t.hero.cardEngraving} />
          <div className="animate-floaty absolute -right-2 top-6 hidden rotate-3 sm:block">
            <div className="card rotate-6 overflow-hidden p-1 shadow-xl">
              <img src="/gallery/doodle.jpg" alt="Child's drawing" className="h-24 w-24 rounded-lg object-cover" />
            </div>
          </div>
        </div>
      </div>

      {videoOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setVideoOpen(false)}
        >
          <div
            className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setVideoOpen(false)}
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
            {videoUrl ? (
              videoUrl.includes("youtube") || videoUrl.includes("youtu.be") ? (
                <iframe className="h-full w-full" src={videoUrl} allow="autoplay; encrypted-media" allowFullScreen />
              ) : (
                <video className="h-full w-full" src={videoUrl} controls autoPlay playsInline />
              )
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-white/80">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-white/10">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M5 3v18l15-9z" />
                  </svg>
                </div>
                <p className="max-w-xs text-sm">{t.hero.videoPlaceholder}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

