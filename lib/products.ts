// Product catalogue, pricing, and customization options.
// Prices are in the smallest Stripe currency unit. JPY is zero-decimal, so the
// unit IS the yen (¥7,500 → 7500). No /100 anywhere.

export type MetalId = "gold" | "silver" | "rosegold";
export type ChainId = "cable" | "rope" | "satellite";
export type StyleId = "enamel" | "engraved" | "photo";

export interface Option<T extends string> {
  id: T;
  label: string;
  desc: string;
  priceDelta: number; // yen added to base
  swatch?: string; // css color for UI
}

export const BASE_PRICE = 7500; // ¥7,500 base

export const METALS: Option<MetalId>[] = [
  { id: "gold", label: "18k Gold Plated", desc: "Warm, classic, never fades", priceDelta: 0, swatch: "#e2c25a" },
  { id: "silver", label: "Sterling Silver", desc: "Bright & modern", priceDelta: 0, swatch: "#c9ccce" },
  { id: "rosegold", label: "Rose Gold", desc: "Soft, romantic blush", priceDelta: 800, swatch: "#e0a899" },
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

export interface Customization {
  style: StyleId;
  metal: MetalId;
  chain: ChainId;
  length: string;
  engraving: string; // back-of-pendant text, optional
  notes: string;
}

export const DEFAULT_CUSTOMIZATION: Customization = {
  style: "enamel",
  metal: "gold",
  chain: "cable",
  length: CHAIN_LENGTHS[1],
  engraving: "",
  notes: "",
};

export function priceFor(c: Pick<Customization, "style" | "metal" | "chain">): number {
  const s = STYLES.find((x) => x.id === c.style)?.priceDelta ?? 0;
  const m = METALS.find((x) => x.id === c.metal)?.priceDelta ?? 0;
  const ch = CHAINS.find((x) => x.id === c.chain)?.priceDelta ?? 0;
  return BASE_PRICE + s + m + ch;
}

export function formatPrice(amount: number): string {
  // JPY is zero-decimal: the amount is already in yen.
  return "¥" + Math.round(amount).toLocaleString("ja-JP");
}
