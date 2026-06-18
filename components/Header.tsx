"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useI18n } from "./LangProvider";
import LangToggle from "./LangToggle";

export default function Header() {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-1.5 px-3 sm:gap-3 sm:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wagamori-logo.png" alt="Wagamori" className="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8" />
          {/* Wordmark hidden only on the narrowest phones (≤360px) so it never
              overlaps the right-side controls; the logo carries the brand there. */}
          <span className="hidden font-display text-sm tracking-[0.12em] whitespace-nowrap min-[376px]:inline sm:text-xl sm:tracking-[0.16em]">
            WAGAMORI
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-foreground/70 md:flex">
          <Link href="/#how" className="transition-colors hover:text-foreground">{t.nav.how}</Link>
          <Link href="/#gallery" className="transition-colors hover:text-foreground">{t.nav.gallery}</Link>
          <Link href="/#reviews" className="transition-colors hover:text-foreground">{t.nav.reviews}</Link>
          <Link href="/showcase" className="transition-colors hover:text-foreground">{t.nav.showcase}</Link>
          <Link href="/blog" className="transition-colors hover:text-foreground">{t.nav.blog}</Link>
          <Link href="/#faq" className="transition-colors hover:text-foreground">{t.nav.faq}</Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <LangToggle />
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                aria-label={t.nav.login}
                title={t.nav.login}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-surface text-foreground/70 transition-colors hover:border-gold-soft hover:text-foreground"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M4.5 19.5a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
                </svg>
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Link
                  label={t.nav.myDesigns}
                  labelIcon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                  }
                  href="/my-designs"
                />
                <UserButton.Link
                  label={t.nav.myOrders}
                  labelIcon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4z" strokeLinejoin="round" />
                      <path d="M4 6h16M9 10a3 3 0 0 0 6 0" strokeLinecap="round" />
                    </svg>
                  }
                  href="/my-orders"
                />
              </UserButton.MenuItems>
            </UserButton>
          </Show>
          <Link
            href="/studio"
            className="btn-primary cursor-pointer whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium sm:px-5 sm:py-2.5 sm:text-sm"
          >
            {t.nav.tryFree}
          </Link>
        </div>
      </div>
    </header>
  );
}
