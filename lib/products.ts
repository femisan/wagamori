// Product catalogue, pricing, and customization options.
// Prices are in the smallest Stripe currency unit. JPY is zero-decimal, so the
// unit IS the yen (¥7,500 → 7500). No /100 anywhere.

export type MetalId = "gold" | "silver" | "rosegold" | "acrylic";
export type ChainId = "cable" | "rope" | "satellite";
export type StyleId = "enamel" | "engraved" | "photo";
// The piece's form factor. A necklace can get grabbed by a baby, so we offer
// a bracelet and a keychain too — same charm, different attachment.
export type FormId = "necklace" | "bracelet" | "keychain";

export interface Option<T extends string> {
  id: T;
  label: string;
  desc: string;
  priceDelta: number; // yen added to base
  swatch?: string; // css color for UI
}

// Three-tier pricing (JPY, zero-decimal for Stripe).
// Tier is determined by material choice:
//   acrylic  → ¥2,000  (printed acrylic keychain)
//   gold / rosegold → ¥3,700  (gold-plated metal keychain)
//   silver   → ¥7,500  (sterling silver jewellery)
export const TIER_PRICES: Record<"acrylic" | "metal" | "silver", number> = {
  acrylic: 2000,
  metal: 3700,
  silver: 7500,
};

export type MaterialTier = keyof typeof TIER_PRICES;

export function materialTier(metal: MetalId): MaterialTier {
  if (metal === "acrylic") return "acrylic";
  if (metal === "silver") return "silver";
  return "metal";
}

/** @deprecated — use TIER_PRICES[materialTier(metal)] directly for clarity */
export const BASE_PRICE = 7500;

export const METALS: Option<MetalId>[] = [
  { id: "gold", label: "18k Gold Plated", desc: "Warm, classic, never fades", priceDelta: 0, swatch: "#e2c25a" },
  { id: "silver", label: "Sterling Silver", desc: "Bright & modern", priceDelta: 0, swatch: "#c9ccce" },
  { id: "rosegold", label: "Rose Gold", desc: "Soft, romantic blush", priceDelta: 0, swatch: "#e0a899" },
  { id: "acrylic", label: "Acrylic Print", desc: "Vibrant full-colour print on clear acrylic", priceDelta: 0, swatch: "#e8f0fe" },
];

export const STYLES: Option<StyleId>[] = [
  {
    id: "enamel",
    label: "Cloisonné Colour (sand + resin)",
    desc: "Colours filled with coloured sand & UV resin, each one framed by metal dividers — just like the real piece",
    priceDelta: 0,
  },
  {
    id: "engraved",
    label: "Fine Line Engraving",
    desc: "Delicate outline etched into the metal",
    priceDelta: -800,
  },
  {
    id: "photo",
    label: "Photo Portrait",
    desc: "A real photo of your pet or child, set in the pendant",
    priceDelta: 1500,
  },
];

export const CHAINS: Option<ChainId>[] = [
  { id: "cable", label: "Cable Chain", desc: "Everyday delicate", priceDelta: 0 },
  { id: "rope", label: "Rope Chain", desc: "Textured & substantial", priceDelta: 1000 },
  { id: "satellite", label: "Satellite Chain", desc: "Tiny beads, subtle sparkle", priceDelta: 700 },
];

export const CHAIN_LENGTHS = ["16in (40cm)", "18in (45cm)", "20in (50cm)"] as const;

// Form factor — same handcrafted charm, different attachment. Same price for
// now (set a priceDelta here later if a form costs more/less to make).
export const FORMS: Option<FormId>[] = [
  { id: "necklace", label: "Necklace", desc: "Worn close to the heart", priceDelta: 0 },
  { id: "bracelet", label: "Bracelet", desc: "On the wrist — out of little hands' reach", priceDelta: 0 },
  { id: "keychain", label: "Keychain / Bag charm", desc: "Clip to a bag, pouch or keys", priceDelta: 0 },
];

export interface Customization {
  form: FormId;
  style: StyleId;
  metal: MetalId;
  chain: ChainId;
  length: string;
  engraving: string; // back-of-pendant text, optional
  notes: string;
}

export const DEFAULT_CUSTOMIZATION: Customization = {
  form: "necklace",
  style: "enamel",
  metal: "gold",
  chain: "cable",
  length: CHAIN_LENGTHS[1],
  engraving: "",
  notes: "",
};

export function priceFor(c: Pick<Customization, "style" | "metal" | "chain" | "form">): number {
  const base = TIER_PRICES[materialTier(c.metal)];
  // Acrylic is flat-price — style/chain add-ons don't apply to a printed charm.
  if (c.metal === "acrylic") return base;
  const s = STYLES.find((x) => x.id === c.style)?.priceDelta ?? 0;
  const ch = CHAINS.find((x) => x.id === c.chain)?.priceDelta ?? 0;
  const f = FORMS.find((x) => x.id === c.form)?.priceDelta ?? 0;
  return base + s + ch + f;
}

export function formatPrice(amount: number): string {
  // JPY is zero-decimal: the amount is already in yen.
  return "¥" + Math.round(amount).toLocaleString("ja-JP");
}
