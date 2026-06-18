"use client";

import Link from "next/link";
import { SITE } from "@/lib/site";
import { useI18n } from "./LangProvider";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-24 border-t border-line bg-surface/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/wagamori-logo.png" alt="Wagamori" className="h-7 w-7 object-contain" />
            <span className="font-display text-lg tracking-[0.16em]">WAGAMORI</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">{t.footer.tagline}</p>
        </div>

        <FooterCol title={t.footer.shop}>
          <FooterLink href="/studio">{t.footer.create}</FooterLink>
          <FooterLink href="/#gallery">{t.nav.gallery}</FooterLink>
          <FooterLink href="/#how">{t.nav.how}</FooterLink>
        </FooterCol>

        <FooterCol title={t.footer.help}>
          <FooterLink href="/track">{t.nav.track}</FooterLink>
          <FooterLink href="/blog">{t.nav.blog}</FooterLink>
          <FooterLink href="/guide/kids-art">{t.footer.guide}</FooterLink>
          <FooterLink href="/#faq">{t.footer.faqShipping}</FooterLink>
          <FooterLink href={`mailto:${SITE.email}`}>{t.footer.contact}</FooterLink>
          <FooterLink href="/#reviews">{t.nav.reviews}</FooterLink>
        </FooterCol>

        <FooterCol title={t.footer.follow}>
          <FooterLink href={SITE.instagram}>Instagram</FooterLink>
          {SITE.tiktok && <FooterLink href={SITE.tiktok}>TikTok</FooterLink>}
          <FooterLink href={SITE.twitter}>X (Twitter)</FooterLink>
        </FooterCol>
      </div>

      <div className="border-t border-line py-5 text-center text-xs text-muted">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/tokushoho" className="transition-colors hover:text-foreground">{t.footer.tokushoho}</Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">{t.footer.privacy}</Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">{t.footer.terms}</Link>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} {SITE.name}. {t.footer.copyright}</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60">
        {title}
      </h4>
      <ul className="space-y-2 text-sm text-muted">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="transition-colors hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}
