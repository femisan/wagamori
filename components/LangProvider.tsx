"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LOCALE_COOKIE,
  dictionaries,
  type Dict,
  type Locale,
} from "@/lib/i18n";

interface I18nCtx {
  locale: Locale;
  t: Dict;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nCtx | null>(null);

export function LangProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLoc] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = useCallback(
    (l: Locale) => {
      // Persist for SSR (server components read this cookie) ...
      document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
      // ... update client components instantly ...
      setLoc(l);
      // ... and re-render server components with the new cookie.
      router.refresh();
    },
    [router],
  );

  return (
    <I18nContext.Provider value={{ locale, t: dictionaries[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <LangProvider>");
  return ctx;
}
