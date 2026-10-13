// AI prompts for the enamel-charm preview (gpt-image-1 `images.edit`).
// Pure functions, no imports — so they can be unit-tested / tried from a script.
//
// The key idea: the output is NOT the photo redrawn in an enamel style. It is a
// small physical piece of jewellery DESIGNED from the photo — abstracted the way
// a real cloisonné workshop would: simplified iconic shapes, few colours, raised
// metal wires as the only lines, shown as a product photo of the finished charm.

export type PromptMetal = "gold" | "rosegold" | "silver";
export type SubjectMode = "solo" | "all";
export type ConnectMode = "joined" | "linked";

const METAL_WORD: Record<PromptMetal, string> = {
  gold: "polished gold",
  rosegold: "polished rose-gold",
  silver: "polished sterling-silver",
};

// Never invent subjects; strip the real-world background and clutter.
const NEVER_INVENT =
  "Use ONLY the people/animals ACTUALLY PRESENT in the photo. NEVER invent, add or duplicate any person, animal, " +
  "face or character. If only one subject is present (e.g. a single cat), the charm shows only that one subject. ";

function subjects(mode: SubjectMode): string {
  if (mode === "all") {
    return (
      NEVER_INVENT +
      "Keep EVERY person/animal present (e.g. all the children in a family photo) and nothing else. " +
      "Leave out EVERYTHING that is not a person or animal: strollers, car seats, furniture, toys, bags, straps, " +
      "chains, clothes patterns, the floor, walls, sky, hands of other people, phone/app UI, text and watermarks. "
    );
  }
  return (
    NEVER_INVENT +
    "Use only the SINGLE main subject (the pet, the child, or the main figure). Leave out everything else — other " +
    "figures, strollers, furniture, toys, props, background, phone/app UI, text and watermarks. "
  );
}

// How the bail / multiple figures are built as real hardware.
function assembly(mode: SubjectMode, connection: ConnectMode, wall: string): string {
  const noFloat = "Every ring is physically attached; no floating or stray rings, no extra chains. ";
  if (mode === "all" && connection === "linked") {
    return (
      `HARDWARE: each figure is its OWN small charm with its own ${wall} outline; the charms hang side by side, joined ` +
      `by small ${wall} jump rings between neighbouring charms, with ONE ${wall} bail loop on top of the centre charm. ` +
      noFloat
    );
  }
  if (mode === "all") {
    return (
      `HARDWARE: all figures are merged into ONE charm sharing a single continuous ${wall} outline, with exactly ONE ` +
      `small ${wall} bail loop on top. ` +
      noFloat
    );
  }
  return `HARDWARE: exactly ONE small ${wall} bail loop attached to the top edge of the charm. ` + noFloat;
}

/** First / fresh attempt: design a charm FROM the original photo. */
export function enamelPrompt(metal: PromptMetal, mode: SubjectMode, connection: ConnectMode, wish = ""): string {
  const wall = METAL_WORD[metal];
  return (
    "TASK: Design a small handmade cloisonné enamel charm (about 3 cm tall) INSPIRED BY this photo. Do NOT trace, " +
    "redraw or recolour the photo — turn it into a simple piece of jewellery that a craftsperson could actually make " +
    "with metal wire and enamel. " +
    subjects(mode) +
    "1) ABSTRACT INTO A JEWELLERY MOTIF (most important): redesign each subject as a cute, simplified, iconic " +
    "character — chibi proportions (large head, small rounded body), smooth rounded silhouette. Keep only what makes " +
    "them recognisable: hairstyle shape, hair colour, main clothing colour, an obvious accessory or pose (e.g. a peace " +
    "sign) if any. Faces are minimal: eyes as small solid dots or short curved lines, a tiny simple mouth, optional " +
    "small blush circles — NO realistic eyes, noses, teeth, wrinkles, shading or fur/hair strands. Hair is 1–2 flat " +
    "shapes, clothing 1–2 flat shapes. Remove patterns, prints, logos, textures and tiny details. Every colour area " +
    "must be large and simple (nothing smaller than a grain of rice at this size). " +
    "2) LIMITED ENAMEL PALETTE: 5–7 enamel colours in total for the whole charm, each area ONE flat colour. Pick each " +
    "colour from the subject's real colour family (black hair stays dark, a yellow shirt stays yellow, skin a soft " +
    "peach) but simplified to clean, slightly pastel enamel tones. No gradients, no shadows, no highlights painted in. " +
    `3) METAL WIRES ARE THE ONLY LINES: a smooth continuous ${wall} outline forms the charm's die-cut silhouette, and ` +
    `thin raised ${wall} cloisonné wires of even width separate every colour area and draw the facial features. ` +
    "There are NO black or drawn outlines anywhere — every line is metal. " +
    "4) MATERIAL: every metal-walled cell is filled with fine coloured sand set in clear glossy UV resin — slightly " +
    "domed, glassy and smooth with a subtle granular sparkle, sitting just below the metal wire tops. " +
    assembly(mode, connection, wall) +
    (wish ? `CUSTOMER WISH for this version (apply it while keeping every rule above): "${wish}". ` : "") +
    "5) PRESENTATION: a realistic macro studio product photograph of the finished physical charm, straight-on front " +
    "view, centred on a pure white background with a soft natural shadow, the charm filling about 70% of the frame, " +
    "with the polished metal edge thickness visible. It must clearly read as a real, small, handmade enamel " +
    "jewellery piece — never as a photo, a painting, an illustration or a sticker."
  );
}

/** Refine an EXISTING version with the customer's wish (e.g. "go back to v2 and…"). */
export function refinePrompt(metal: PromptMetal, wish: string, metalChanged: boolean): string {
  const wall = METAL_WORD[metal];
  return (
    "This image is a handmade cloisonné enamel charm. Apply ONLY the customer's change and keep everything else " +
    "exactly the same — same character design, pose, silhouette, colours, metal wires and presentation. " +
    `Customer request: "${wish}". ` +
    (metalChanged
      ? `Also change the metal (outline, cloisonné wires, bail and rings) to ${wall}; nothing else changes. `
      : "") +
    "Keep it a simplified jewellery motif: flat enamel colour areas (coloured sand in glossy resin) separated only by " +
    `thin raised ${wall} metal wires, no drawn black outlines, no realistic shading or details, a smooth continuous ` +
    "metal outline, rings physically attached, on a pure white background as a product photo. Never add subjects " +
    "that are not already there. No text."
  );
}
