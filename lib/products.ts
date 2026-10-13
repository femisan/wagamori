// Product catalogue, pricing, and customization options.
// Prices are in the smallest Stripe currency unit. JPY is zero-decimal, so the
// unit IS the yen (¥7,500 → 7500). No /100 anywhere.
//
// Every piece is a colourful cloisonné enamel charm (the AI preview only
// renders that). What differs is the base MATERIAL:
//   alloy  — enamel on a gold / rose-gold plated alloy badge. Great as a
//            keychain or bag charm; NOT recommended against skin (allergy risk).
//   silver — enamel on 925 sterling silver. Hypoallergenic → fine as jewellery.

export type MaterialId = "alloy" | "silver";
export type MetalId = "gold" | "rosegold" | "silver";
export type ChainId = "cable" | "rope" | "satellite";
export type StyleId = "enamel";
export type FormId = "necklace" | "bracelet" | "keychain";

export interface Option<T extends string> {
  id: T;
  label: string;
  desc: string;
  priceDelta: number; // yen added to base
  swatch?: string; // css color for UI
}

export const MATERIAL_PRICES: Record<MaterialId, number> = {
  alloy: 3700,
  silver: 7500,
};

export interface MaterialDef {
  id: MaterialId;
  metals: MetalId[]; // colour finishes available on this material
  forms: FormId[]; // allowed form factors
  jewelry: boolean; // safe to wear against skin
}

export const MATERIALS: MaterialDef[] = [
  { id: "alloy", metals: ["gold", "rosegold"], forms: ["keychain"], jewelry: false },
  { id: "silver", metals: ["silver"], forms: ["necklace", "bracelet", "keychain"], jewelry: true },
];

export function materialOf(metal: string | null | undefined): MaterialId {
  return metal === "silver" ? "silver" : "alloy";
}

export function materialDef(id: MaterialId): MaterialDef {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}

export function allowedForms(metal: MetalId): FormId[] {
  return materialDef(materialOf(metal)).forms;
}

export function isMetal(v: unknown): v is MetalId {
  return v === "gold" || v === "rosegold" || v === "silver";
}

export function isForm(v: unknown): v is FormId {
  return v === "necklace" || v === "bracelet" || v === "keychain";
}

export const METALS: Option<MetalId>[] = [
  { id: "gold", label: "Gold-plated alloy", desc: "Warm gold metal walls", priceDelta: 0, swatch: "#e2c25a" },
  { id: "rosegold", label: "Rose-gold-plated alloy", desc: "Soft blush metal walls", priceDelta: 0, swatch: "#e0a899" },
  { id: "silver", label: "Sterling Silver 925", desc: "Hypoallergenic, jewellery-grade", priceDelta: 0, swatch: "#c9ccce" },
];

export const CHAIN_LENGTHS = ["16in (40cm)", "18in (45cm)", "20in (50cm)"] as const;

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
  form: "keychain",
  style: "enamel",
  metal: "gold",
  chain: "cable",
  length: CHAIN_LENGTHS[1],
  engraving: "",
  notes: "",
};

/** Clamp a customization to what its material allows (e.g. alloy → keychain). */
export function normalizeCustomization(c: Partial<Customization>): Customization {
  const metal = isMetal(c.metal) ? c.metal : DEFAULT_CUSTOMIZATION.metal;
  const forms = allowedForms(metal);
  const form = isForm(c.form) && forms.includes(c.form) ? c.form : forms[0];
  return {
    ...DEFAULT_CUSTOMIZATION,
    style: "enamel",
    metal,
    form,
    length: typeof c.length === "string" && c.length ? c.length : DEFAULT_CUSTOMIZATION.length,
    engraving: (c.engraving ?? "").toString().slice(0, 24),
    notes: (c.notes ?? "").toString().slice(0, 500),
  };
}

// "ai" = produce the AI version the customer picked; "human" = the customer
// stopped the AI and asked a designer to make the design after payment.
export type DesignMode = "ai" | "human";

// Extra charge for designer-made artwork (yen). 0 = included in the piece price.
export const HUMAN_DESIGN_FEE = 0;

/** Authoritative price — the server always recomputes this; never trust the client. */
export function priceFor(c: Pick<Customization, "metal" | "form">, mode: DesignMode = "ai"): number {
  const base = MATERIAL_PRICES[materialOf(c.metal)];
  const f = FORMS.find((x) => x.id === c.form)?.priceDelta ?? 0;
  return base + f + (mode === "human" ? HUMAN_DESIGN_FEE : 0);
}

export function formatPrice(amount: number): string {
  // JPY is zero-decimal: the amount is already in yen.
  return "¥" + Math.round(amount).toLocaleString("ja-JP");
}
