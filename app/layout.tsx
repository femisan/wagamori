import {ClerkProvider} from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Fraunces, Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { LangProvider } from "@/components/LangProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

// Japanese-capable fallbacks (the primary market). Large CJK families →
// preload disabled; the latin display/sans fonts above stay the primary face.
const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  preload: false,
});

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale);
  const title =
    locale === "ja"
      ? `${SITE.name} — 心の、いちばん近くで。`
      : `${SITE.name} — Closest to your heart.`;
  const description = t.hero.subtitle;
  return {
    metadataBase: new URL(SITE.url),
    title: { default: title, template: `%s · ${SITE.name}` },
    description,
    keywords: [
      "オーダーメイド ネックレス",
      "子供 絵 ネックレス",
      "ペット ネックレス",
      "名入れ ジュエリー",
      "記念 ギフト",
      "custom necklace",
      "kids drawing necklace",
      "pet portrait necklace",
    ],
    openGraph: {
      title,
      description,
      url: SITE.url,
      siteName: SITE.name,
      type: "website",
      locale: locale === "ja" ? "ja_JP" : "en_US",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${fraunces.variable} ${notoSansJP.variable} ${notoSerifJP.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-warm-grad">
        <ClerkProvider>
          <LangProvider initialLocale={locale}>{children}</LangProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}