// Product catalogue, pricing, and customization options.
// Prices are in the smallest Stripe currency unit. JPY is zero-decimal, so the
// unit IS the yen (¥7,500 → 7500). No /100 anywhere.
//
// Every piece is a colourful cloisonné enamel charm (the AI preview only
// renders that). Two things vary independently:
//   MATERIAL — alloy: gold enamel only, keychain / bag charm only (NOT for skin:
//              allergy risk). silver: 925 sterling silver, hypoallergenic →
//              jewellery; can be plated, so silver / gold / rose-gold colours.
//   COLOUR   — the metal colour (divider wires, outline, bail). The AI artwork
//              is drawn with that colour, so a version is tied to its colour,
//              not to its material (a gold version can be alloy or gold-plated silver).

export type MaterialId = "alloy" | "silver";
export type MetalId = "gold" | "rosegold" | "silver"; // metal COLOUR
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
  metals: MetalId[]; // colours available on this material (first = default)
  forms: FormId[]; // allowed form factors (first = default)
  jewelry: boolean; // safe to wear against skin
}

export const MATERIALS: MaterialDef[] = [
  { id: "alloy", metals: ["gold"], forms: ["keychain"], jewelry: false },
  { id: "silver", metals: ["silver", "gold", "rosegold"], forms: ["necklace", "bracelet", "keychain"], jewelry: true },
];

export function isMaterial(v: unknown): v is MaterialId {
  return v === "alloy" || v === "silver";
}

export function isMetal(v: unknown): v is MetalId {
  return v === "gold" || v === "rosegold" || v === "silver";
}

export function isForm(v: unknown): v is FormId {
  return v === "necklace" || v === "bracelet" || v === "keychain";
}

export function materialDef(id: MaterialId): MaterialDef {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];
}

/** Best guess for records saved before material was stored separately. */
export function legacyMaterialOf(metal: string | null | undefined): MaterialId {
  return metal === "gold" ? "alloy" : "silver";
}

export function allowedForms(material: MaterialId): FormId[] {
  return materialDef(material).forms;
}

export function allowedMetals(material: MaterialId): MetalId[] {
  return materialDef(material).metals;
}

export const METALS: Option<MetalId>[] = [
  { id: "silver", label: "Silver", desc: "Bright silver", priceDelta: 0, swatch: "#c9ccce" },
  { id: "gold", label: "Gold", desc: "Warm gold", priceDelta: 0, swatch: "#e2c25a" },
  { id: "rosegold", label: "Rose gold", desc: "Soft blush", priceDelta: 0, swatch: "#e0a899" },
];

export const CHAIN_LENGTHS = ["16in (40cm)", "18in (45cm)", "20in (50cm)"] as const;

export const FORMS: Option<FormId>[] = [
  { id: "necklace", label: "Necklace", desc: "Worn close to the heart", priceDelta: 0 },
  { id: "bracelet", label: "Bracelet", desc: "On the wrist — out of little hands' reach", priceDelta: 0 },
  { id: "keychain", label: "Keychain / Bag charm", desc: "Clip to a bag, pouch or keys", priceDelta: 0 },
];

export interface Customization {
  material: MaterialId;
  form: FormId;
  style: StyleId;
  metal: MetalId;
  chain: ChainId;
  length: string;
  engraving: string; // back-of-pendant text, optional
  notes: string;
}

export const DEFAULT_CUSTOMIZATION: Customization = {
  material: "alloy",
  form: "keychain",
  style: "enamel",
  metal: "gold",
  chain: "cable",
  length: CHAIN_LENGTHS[1],
  engraving: "",
  notes: "",
};

/** Clamp a customization to what its material allows (alloy → gold keychain). */
export function normalizeCustomization(c: Partial<Customization> & { metal?: string }): Customization {
  const material: MaterialId = isMaterial(c.material) ? c.material : legacyMaterialOf(c.metal);
  const metals = allowedMetals(material);
  const metal = isMetal(c.metal) && metals.includes(c.metal) ? c.metal : metals[0];
  const forms = allowedForms(material);
  const form = isForm(c.form) && forms.includes(c.form) ? c.form : forms[0];
  return {
    ...DEFAULT_CUSTOMIZATION,
    material,
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
export function priceFor(c: Pick<Customization, "material" | "form">, mode: DesignMode = "ai"): number {
  const base = MATERIAL_PRICES[c.material];
  const f = FORMS.find((x) => x.id === c.form)?.priceDelta ?? 0;
  return base + f + (mode === "human" ? HUMAN_DESIGN_FEE : 0);
}

export function formatPrice(amount: number): string {
  // JPY is zero-decimal: the amount is already in yen.
  return "¥" + Math.round(amount).toLocaleString("ja-JP");
}
