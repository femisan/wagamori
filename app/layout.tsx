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
      ? `子供の絵・ペット写真でつくるオーダーメイドネックレス｜わが守(${SITE.name})`
      : `Custom necklaces from your kid's drawing or pet photo | ${SITE.name}`;
  const description = t.hero.subtitle;
  return {
    metadataBase: new URL(SITE.url),
    title: { default: title, template: `%s · ${SITE.name}` },
    description,
    keywords: [
      "子供の絵 ネックレス",
      "子供の絵 キーホルダー",
      "子供の絵 ジュエリー",
      "ペット 写真 ネックレス",
      "ペット ブレスレット",
      "ペット キーホルダー",
      "似顔絵 ネックレス オーダーメイド",
      "似顔絵 キーホルダー",
      "写真 ネックレス オーダーメイド",
      "名入れ ネックレス キーホルダー",
      "出産祝い 記念 ギフト",
      "誕生日 プレゼント ネックレス",
      "オーダーメイド ブレスレット",
      "custom necklace bracelet keychain from kids drawing",
      "pet photo necklace keychain",
    ],
    openGraph: {
      title,
      description,
      url: SITE.url,
      siteName: SITE.name,
      type: "website",
      locale: locale === "ja" ? "ja_JP" : "en_US",
      images: [{ url: "/gallery/hero.jpg", width: 1024, height: 1024, alt: SITE.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/gallery/hero.jpg"] },
    alternates: { canonical: SITE.url },
  };
}

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#org`,
      name: SITE.name,
      alternateName: "わが守",
      url: SITE.url,
      logo: `${SITE.url}/brand/wagamori-logo.png`,
      email: SITE.email,
      description: SITE.description,
      areaServed: "JP",
      knowsLanguage: ["ja", "en"],
      sameAs: [SITE.instagram],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      url: SITE.url,
      inLanguage: "ja-JP",
      publisher: { "@id": `${SITE.url}/#org` },
    },
    {
      "@type": "Product",
      name: "オーダーメイド 似顔絵アクセサリー（子供の絵・ペット写真）",
      description:
        "お子さまが描いた絵やペットの写真を、ひとつずつ手作りのアクセサリーに。ネックレス・ブレスレット・キーホルダーから選べます。名入れ・刻印対応、世界中へ送料無料。七宝（クロワゾネ）エナメル仕上げ。",
      category: "ハンドメイドジュエリー / ネックレス・ブレスレット・キーホルダー",
      brand: { "@id": `${SITE.url}/#org` },
      image: `${SITE.url}/gallery/hero.jpg`,
      offers: {
        "@type": "Offer",
        price: "7500",
        priceCurrency: "JPY",
        availability: "https://schema.org/InStock",
        url: `${SITE.url}/studio`,
      },
    },
  ],
};

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <ClerkProvider>
          <LangProvider initialLocale={locale}>{children}</LangProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}