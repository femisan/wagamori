// Central site config. Update url/email after first deploy + domain setup.
export const SITE = {
  name: "Wagamori",
  // Canonical brand domain (used for OG/canonical, QR, tracking + email links).
  // Override with NEXT_PUBLIC_SITE_URL if ever needed.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://wagamori.com",
  description:
    "Turn your child's drawing or your pet's photo into a handcrafted, wear-everyday necklace. Upload a photo, preview it in seconds, and we craft the real thing.",
  email: "wagamori.info@gmail.com",
  instagram: "https://www.instagram.com/wagamori.studio",
  tiktok: "", // set when a real TikTok account exists
  // LINE official account URL for CS / design consultation (set in env).
  lineUrl: process.env.NEXT_PUBLIC_LINE_URL || "",
  currency: "jpy",
  currencySymbol: "¥",
} as const;
