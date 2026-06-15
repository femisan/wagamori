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
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--rose)" }} />
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
          <FooterLink href="/#faq">{t.footer.faqShipping}</FooterLink>
          <FooterLink href={`mailto:${SITE.email}`}>{t.footer.contact}</FooterLink>
          <FooterLink href="/#reviews">{t.nav.reviews}</FooterLink>
        </FooterCol>

        <FooterCol title={t.footer.follow}>
          <FooterLink href={SITE.instagram}>Instagram</FooterLink>
          <FooterLink href={SITE.tiktok}>TikTok</FooterLink>
        </FooterCol>
      </div>

      <div className="border-t border-line py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} {SITE.name}. {t.footer.copyright}
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
