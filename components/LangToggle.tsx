"use client";

import { locales, type Locale } from "@/lib/i18n";
import { useI18n } from "./LangProvider";

const SHORT: Record<Locale, string> = { ja: "日本語", en: "EN" };

/** Compact JA / EN switch shown in the header. */
export default function LangToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <div
      className={`inline-flex shrink-0 items-center rounded-full border border-line bg-surface p-0.5 text-xs ${className}`}
      role="group"
      aria-label="Language"
    >
      {locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            className={`cursor-pointer whitespace-nowrap rounded-full px-2 py-1 transition-colors sm:px-2.5 ${
              active
                ? "bg-rose/15 font-medium text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {SHORT[l]}
          </button>
        );
      })}
    </div>
  );
}
