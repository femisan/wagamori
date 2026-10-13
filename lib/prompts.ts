// AI prompts for the enamel-charm preview (gpt-image-1 `images.edit`).
// Pure functions, no imports — so they can be tried from a script.
//
// Wording is the 2f101c7 version (best results in practice). Only two changes:
// the bail / divider metal follows the chosen colour (it was hard-coded gold),
// and an optional customer wish is appended for retries.

export type PromptMetal = "gold" | "rosegold" | "silver";
// How many of the drawn subjects to keep.
export type SubjectMode = "solo" | "all";
// How multiple figures are assembled into one necklace.
export type ConnectMode = "joined" | "linked";

// Metal colour used for the cloisonné divider walls.
const METAL_WORD: Record<PromptMetal, string> = {
  gold: "shiny gold",
  silver: "bright polished silver",
  rosegold: "soft rose-gold",
};

// Assembly + bail instructions (also fixes stray floating rings).
function assembly(mode: SubjectMode, connection: ConnectMode, wall: string): string {
  const noFloat =
    " CRITICAL: do NOT add any stray, floating or detached metal ring — every loop/ring must be physically attached to a figure or to a chain. ";
  if (mode !== "all") {
    return (
      ` Attach exactly ONE small ${wall} bail loop at the very top of the pendant, physically connected to the top of the artwork (never floating separately).` +
      noFloat
    );
  }
  if (connection === "linked") {
    return (
      " ASSEMBLY: make each figure its OWN separate flat charm, then connect the charms side by side in a single " +
      `horizontal row using small ${wall} jump rings and short ${wall} chain segments between adjacent charms (like a ` +
      "connected charm necklace). Each charm has its own small attachment loop on its side; the short chains link the " +
      "charms together into one continuous piece. No charm and no ring floats unattached." +
      noFloat
    );
  }
  return (
    " ASSEMBLY: combine ALL the figures into ONE single connected pendant — the figures touch, overlap or share one " +
    `joined base so the whole thing is a single solid piece — with exactly ONE small ${wall} bail loop at the very top, ` +
    "physically attached to the piece." +
    noFloat
  );
}

// Remove the real-world background/clutter; "all" keeps every drawn figure.
// IMPORTANT: never invent subjects that are not in the image.
const NEVER_INVENT =
  "Use ONLY what is ACTUALLY PRESENT in the image. NEVER invent, add, duplicate or imagine any extra person, animal, " +
  "face or character that is not in the original. If only one subject is present (e.g. a single cat), the result must " +
  "contain only that one subject — do NOT add any people or a family. ";

function isolation(mode: SubjectMode): string {
  if (mode === "all") {
    return (
      NEVER_INVENT +
      "Keep ALL the subjects and elements that are actually present in the image (for example, if a family of several " +
      "people is drawn together, keep them all) as one piece. Do not drop any present subject and do not add any absent " +
      "one. Remove ONLY the real-world background and clutter: table, floor, walls, the hand holding it, the phone or " +
      "app interface, status bars, captions, watermarks, tape and any surrounding background. "
    );
  }
  return (
    NEVER_INVENT +
    "Identify the SINGLE main subject actually present (the pet, the child/person, or the main figure). Use ONLY that " +
    "one subject. Remove everything else — the background, scenery, rooms, furniture, any OTHER figures, hands holding " +
    "it, text, watermarks and clutter. "
  );
}

// Keep the artwork's real colours — gpt-image-1 otherwise drifts warm/yellow.
function colorFidelity(wall: string): string {
  return (
    "COLOUR ACCURACY (very important): faithfully reproduce the EXACT colours of the original artwork — keep every hue " +
    "true to what was actually drawn (blue stays blue, red stays red, brown hair stays brown, plain/cream paper areas " +
    "become clean neutral white). Do NOT add any yellow, golden, warm or sepia tint to the colour fills and do not shift " +
    `or recolour the palette. ONLY the thin divider lines are ${wall} metal; every colour inside the cells must match the ` +
    "original drawing's colours. "
  );
}

/** First / fresh attempt from the original photo. */
export function enamelPrompt(metal: PromptMetal, mode: SubjectMode, connection: ConnectMode, wish = ""): string {
  const wall = METAL_WORD[metal] ?? METAL_WORD.gold;
  const subj = mode === "all" ? "the whole drawing (all the figures and elements together)" : "that single subject";
  return (
    isolation(mode) +
    `Turn ${subj} into a real handcrafted cloisonné-style enamel jewelry pendant, in TWO steps. ` +
    `STEP 1 — STYLISE: if the input is a realistic photo, do NOT keep it photographic — reinterpret it as a bold ` +
    `flat-colour-block cartoon/comic illustration (sticker / anime cel / pop-art): large clean areas of solid flat ` +
    `colour, simple outlines, minimal detail, and NO photographic gradients, shadows or texture. If it is already a ` +
    `drawing, keep its charm but simplify it into clean flat colour areas. ` +
    (mode === "all" ? `Arrange ALL the figures/elements together as one balanced composition. ` : ``) +
    `STEP 2 — CLOISONNÉ: every area of colour must be fully enclosed by thin raised ${wall} metal divider lines ` +
    `(cloisonné wires). No two colours ever touch directly — there is ALWAYS a thin ${wall} metal wall between one ` +
    `colour and the next, and around the outside of every shape. Fill each metal-walled cell with fine coloured sand ` +
    `set in clear glossy UV resin: a subtle granular sandy texture with a wet, glassy resin sheen. Flat colour blocks ` +
    `divided by metal, centered on a pure clean WHITE background with generous margin. No gradients inside a cell, no ` +
    `text. ` +
    assembly(mode, connection, wall) +
    colorFidelity(wall) +
    (wish ? `CUSTOMER WISH for this version (apply it while keeping the style above): "${wish}". ` : "") +
    `The final result must look like an actual metal-and-resin pendant, not a photo and not a flat drawing.`
  );
}

/** Refine an EXISTING version with the customer's wish (2f101c7 edit prompt). */
export function refinePrompt(metal: PromptMetal, wish: string, metalChanged: boolean): string {
  const wall = METAL_WORD[metal] ?? METAL_WORD.gold;
  return (
    `You are refining an existing handcrafted cloisonné enamel jewelry pendant image. Apply ONLY the change the ` +
    `customer asks for and keep everything else the same. Customer request: "${wish.slice(0, 300)}". ` +
    (metalChanged ? `Also change all the metal (divider lines, outline and bail) to ${wall}. ` : "") +
    `Keep the cloisonné style intact: every area of colour fully enclosed by thin raised ${wall} metal divider lines, ` +
    `no two colours touching, coloured-sand + glossy UV resin fill, flat colour blocks, a pure clean WHITE background, ` +
    `exactly one small ${wall} bail loop at the top attached to the piece, and NO floating/detached rings. Keep all other ` +
    `colours faithful to the current image and do not add a yellow/warm tint. No text.`
  );
}
