"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import Faq from "@/components/Faq";
import ShowcaseTeaser from "@/components/ShowcaseTeaser";
import { useI18n } from "@/components/LangProvider";

const GALLERY_SRC = ["/gallery/1.jpg", "/gallery/2.jpg", "/gallery/3.jpg", "/gallery/4.jpg"];

export default function Home() {
  const { t } = useI18n();
  return (
    <>
      <Header />
      <Hero />

      {/* Trust bar */}
      <section className="border-y border-line bg-surface/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-5 text-sm text-muted">
          <span>✓ {t.trust.shipping}</span>
          <span>✓ {t.trust.hypo}</span>
          <span>✓ {t.trust.handmade}</span>
          <span>✓ {t.trust.guarantee}</span>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <Header2 kicker={t.how.kicker} title={t.how.title} />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {t.how.steps.map((s, i) => (
            <div key={s.t} className="card p-7">
              <span className="btn-primary grid h-10 w-10 place-items-center rounded-full font-display">{i + 1}</span>
              <h3 className="mt-4 font-display text-2xl">{s.t}</h3>
              <p className="mt-2 text-muted">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/studio" className="btn-primary cursor-pointer rounded-full px-7 py-3.5 text-base font-medium">
            {t.how.cta}
          </Link>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <Header2 kicker={t.gallery.kicker} title={t.gallery.title} />
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            {GALLERY_SRC.map((src, i) => (
              <figure key={src} className="group">
                <div className="card overflow-hidden p-2 transition group-hover:-translate-y-1 group-hover:shadow-lg">
                  <img src={src} alt={t.gallery.captions[i]} className="aspect-square w-full rounded-xl object-cover" />
                </div>
                <figcaption className="mt-2 text-center text-sm text-muted">{t.gallery.captions[i]}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Buyer-show teaser (hidden until customers post) */}
      <ShowcaseTeaser />

      {/* Emotional value */}
      <section className="mx-auto max-w-5xl px-5 py-20 text-center">
        <p className="font-display text-3xl italic leading-snug text-foreground/90 md:text-4xl">
          {t.quote.text}
        </p>
        <p className="mt-5 text-sm uppercase tracking-[0.2em] text-muted">{t.quote.label}</p>
      </section>

      {/* Reviews */}
      <section id="reviews" className="bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <Header2 kicker={t.reviews.kicker} title={t.reviews.title} />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {t.reviews.items.map((r) => (
              <div key={r.title} className="card p-7">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-rose/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="1.8">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h3 className="mt-4 font-display text-xl">{r.title}</h3>
                <p className="mt-2 text-muted">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-5 py-20">
        <Header2 kicker={t.faq.kicker} title={t.faq.title} />
        <div className="mt-10">
          <Faq />
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#4a2530] to-[#6e3a44] px-6 py-16 text-center text-white">
          <h2 className="font-display text-4xl md:text-5xl">{t.finalCta.title}</h2>
          <p className="mx-auto mt-3 max-w-md text-white/70">{t.finalCta.sub}</p>
          <Link
            href="/studio"
            className="mt-7 inline-block cursor-pointer rounded-full bg-white px-8 py-4 text-base font-medium text-foreground transition hover:bg-blush"
          >
            {t.finalCta.button}
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}

function Header2({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-rose">{kicker}</p>
      <h2 className="mt-2 font-display text-3xl md:text-4xl">{title}</h2>
    </div>
  );
}
