"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useI18n } from "./LangProvider";
import LangToggle from "./LangToggle";

export default function Header() {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--rose)" }} />
          <span className="font-display text-base tracking-[0.1em] whitespace-nowrap sm:text-xl sm:tracking-[0.16em]">
            WAGAMORI
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-foreground/70 md:flex">
          <Link href="/#how" className="transition-colors hover:text-foreground">{t.nav.how}</Link>
          <Link href="/#gallery" className="transition-colors hover:text-foreground">{t.nav.gallery}</Link>
          <Link href="/#reviews" className="transition-colors hover:text-foreground">{t.nav.reviews}</Link>
          <Link href="/#faq" className="transition-colors hover:text-foreground">{t.nav.faq}</Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LangToggle />
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="hidden cursor-pointer whitespace-nowrap text-sm text-foreground/70 transition-colors hover:text-foreground sm:inline">
                {t.nav.login}
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Link
            href="/studio"
            className="btn-primary cursor-pointer whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium sm:px-5 sm:py-2.5 sm:text-sm"
          >
            {t.nav.tryFree}
          </Link>
        </div>
      </div>
    </header>
  );
}
