import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import type { StyleId } from "@/lib/products";

export const runtime = "nodejs";
// gpt-image-1 can occasionally take >60s; allow headroom to avoid 504s.
export const maxDuration = 120;

// Metal colour used for the cloisonné divider walls. Defaults to gold.
type MetalTint = "gold" | "silver" | "rosegold";
const METAL_WORD: Record<MetalTint, string> = {
  gold: "shiny gold",
  silver: "bright polished silver",
  rosegold: "soft rose-gold",
};

// How many of the drawn subjects to keep.
type SubjectMode = "solo" | "all";
// How multiple figures are assembled into one necklace.
type ConnectMode = "joined" | "linked";

// Assembly + bail instructions (also fixes stray floating rings).
function assembly(mode: SubjectMode, connection: ConnectMode): string {
  const noFloat =
    " CRITICAL: do NOT add any stray, floating or detached metal ring — every loop/ring must be physically attached to a figure or to a chain. ";
  if (mode !== "all") {
    return (
      " Attach exactly ONE small gold bail loop at the very top of the pendant, physically connected to the top of the artwork (never floating separately)." +
      noFloat
    );
  }
  if (connection === "linked") {
    return (
      " ASSEMBLY: make each figure its OWN separate flat charm, then connect the charms side by side in a single " +
      "horizontal row using small gold jump rings and short gold chain segments between adjacent charms (like a " +
      "connected charm necklace). Each charm has its own small attachment loop on its side; the short chains link the " +
      "charms together into one continuous piece. No charm and no ring floats unattached." +
      noFloat
    );
  }
  return (
    " ASSEMBLY: combine ALL the figures into ONE single connected pendant — the figures touch, overlap or share one " +
    "joined base so the whole thing is a single solid piece — with exactly ONE small gold bail loop at the very top, " +
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
const COLOR_FIDELITY =
  "COLOUR ACCURACY (very important): faithfully reproduce the EXACT colours of the original artwork — keep every hue " +
  "true to what was actually drawn (blue stays blue, red stays red, brown hair stays brown, plain/cream paper areas " +
  "become clean neutral white). Do NOT add any yellow, golden, warm or sepia tint to the colour fills and do not shift " +
  "or recolour the palette. ONLY the thin divider lines are metallic gold; every colour inside the cells must match the " +
  "original drawing's colours. ";

function enamelPrompt(metal: MetalTint, mode: SubjectMode, connection: ConnectMode): string {
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
    assembly(mode, connection) +
    COLOR_FIDELITY +
    `The final result must look like an actual metal-and-resin pendant, not a photo and not a flat drawing.`
  );
}

function promptFor(style: StyleId, metal: MetalTint, mode: SubjectMode, connection: ConnectMode): string {
  if (style === "engraved") {
    const subj = mode === "all" ? "the whole drawing" : "that subject";
    return (
      isolation(mode) +
      `Convert ${subj} into an elegant minimalist single-line-art portrait: thin clean black lines on a pure white ` +
      `background, no shading, no colour, centered with margin, suitable for laser-engraving onto a small gold pendant. No text.`
    );
  }
  if (style === "photo") {
    const subj = mode === "all" ? "the subjects" : "that subject only";
    return (
      isolation(mode) +
      `Produce a clean, softly-lit portrait of ${subj}, cleanly cut out from the original background and placed on a ` +
      `neutral cream studio background, centered with margin, suitable for setting inside a small round jewelry pendant. ` +
      `Keep it photographic and true to the original colours. No text.`
    );
  }
  return enamelPrompt(metal, mode, connection);
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("image");
    const style = (form.get("style") as StyleId) || "enamel";
    const metal = (form.get("metal") as MetalTint) || "gold";
    const subjects: SubjectMode = form.get("subjects") === "solo" ? "solo" : "all";
    const connection: ConnectMode = form.get("connection") === "linked" ? "linked" : "joined";

    if (!(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "No image uploaded." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // No key configured — tell the client to use its local canvas fallback.
      return NextResponse.json({ ok: false, fallback: true, reason: "no_api_key" });
    }

    const openai = new OpenAI({ apiKey });
    const buf = Buffer.from(await file.arrayBuffer());
    const image = await toFile(buf, "upload.png", { type: file.type || "image/png" });

    const result = await openai.images.edit({
      model: "gpt-image-1",
      image,
      prompt: promptFor(style, metal, subjects, connection),
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ ok: false, fallback: true, reason: "empty" });
    }

    return NextResponse.json({ ok: true, image: `data:image/png;base64,${b64}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    // Any failure (quota, content, timeout) → client falls back gracefully.
    return NextResponse.json({ ok: false, fallback: true, error: message });
  }
}
