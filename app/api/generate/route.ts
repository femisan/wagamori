import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import OpenAI, { toFile } from "openai";
import type { StyleId } from "@/lib/products";

// Per-IP rate limit: N requests per hour before gpt-image-1 is called.
const RATE_LIMIT = 3;

// Module-level SQL handle (one per cold start — stateless HTTP driver, safe).
const _sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter: number }> {
  if (!_sql) return { allowed: true, retryAfter: 0 };
  try {
    // Bootstrap the table on first use; DDL is a fast no-op when it exists.
    await _sql`
      CREATE TABLE IF NOT EXISTS ai_rate_limits (
        ip       TEXT PRIMARY KEY,
        count    INT NOT NULL DEFAULT 1,
        reset_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour')
      )
    `;
    const rows = await _sql`
      INSERT INTO ai_rate_limits (ip, count, reset_at)
      VALUES (${ip}, 1, now() + INTERVAL '1 hour')
      ON CONFLICT (ip) DO UPDATE SET
        count    = CASE WHEN ai_rate_limits.reset_at <= now()
                        THEN 1 ELSE ai_rate_limits.count + 1 END,
        reset_at = CASE WHEN ai_rate_limits.reset_at <= now()
                        THEN now() + INTERVAL '1 hour' ELSE ai_rate_limits.reset_at END
      RETURNING count,
                GREATEST(0, EXTRACT(EPOCH FROM (reset_at - now()))::int) AS retry_after
    `;
    const row = (rows as Array<{ count: number; retry_after: number }>)[0];
    return {
      allowed: (row?.count ?? 1) <= RATE_LIMIT,
      retryAfter: row?.retry_after ?? 3600,
    };
  } catch {
    return { allowed: true, retryAfter: 0 }; // fail open on DB errors
  }
}

export const runtime = "nodejs";
// gpt-image-1 can occasionally take >60s; allow headroom to avoid 504s.
export const maxDuration = 120;

type MetalTint = "gold" | "silver" | "rosegold" | "acrylic";

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

// Colour accuracy reminder — gpt-image-1 otherwise drifts warm/yellow.
const COLOR_ACCURACY =
  "COLOUR ACCURACY (very important): faithfully reproduce the EXACT colours of the original artwork — keep every hue " +
  "true to what was actually drawn (blue stays blue, red stays red, brown hair stays brown, plain/cream paper areas " +
  "become clean neutral white). Do NOT add any yellow, golden, warm or sepia tint to the colour fills. ";

// Gold / rose-gold tier: flat print on a metal badge charm (not cloisonné).
function metalBadgePrompt(metal: "gold" | "rosegold", mode: SubjectMode, connection: ConnectMode): string {
  const metalColor = metal === "rosegold" ? "rose-gold" : "shiny gold";
  const subj = mode === "all" ? "the whole drawing (all figures and elements together)" : "that single main subject";
  return (
    isolation(mode) +
    `Turn ${subj} into a bold flat-print design for a ${metalColor} metal badge keychain charm. ` +
    `Style: vibrant anime / bold cartoon illustration — large clean areas of solid flat colour, strong clean outlines, ` +
    `vivid saturated colours. No gradients, no metallic textures inside the design itself. ` +
    `IMPORTANT: do NOT add any cloisonné wires, enamel divider lines, or enamel cell walls — ` +
    `this is a FLAT PRINT on metal, not cloisonné enamel. ` +
    (mode === "all" ? `Arrange ALL figures and elements as one balanced composition. ` : ``) +
    `The design is printed on a circular ${metalColor} metal badge with a subtle metallic sheen around the design. ` +
    `Center the artwork on a PURE WHITE background with generous margin on all sides. ` +
    assembly(mode, connection) +
    COLOR_ACCURACY +
    `The result must look like a vivid, bold graphic PRINTED on a shiny ${metalColor} metal badge — ` +
    `not cloisonné enamel, not a photo, not a sketch.`
  );
}

// Silver tier: 925 sterling silver jewelry pendant (fine-line, minimalist).
function silverJewelryPrompt(mode: SubjectMode): string {
  const subj = mode === "all" ? "the whole drawing (all figures and elements)" : "that single main subject";
  return (
    isolation(mode) +
    `Turn ${subj} into an elegant fine-line design for a 925 sterling silver jewelry pendant. ` +
    `Style: minimalist and refined — simplify the subject into clean, delicate thin line art. ` +
    `Thin precise lines only; no colour fills, no gradients, no bold outlines, no enamel. ` +
    `The design should evoke fine line engraving or silver wire-work etched into a polished silver surface. ` +
    (mode === "all" ? `Arrange all elements into one elegant unified composition. ` : ``) +
    `Present the artwork as subtle, precise silver-toned line art centered on a pure white background ` +
    `with generous margin — evoking a high-end 925 silver pendant charm: refined, minimal, jewellery-quality. ` +
    `Do NOT add any bails, rings, chains or clasps — output only the charm design. No text, no colour fills. ` +
    `The result must feel like an elegant minimalist piece of fine silver jewellery — ` +
    `not a sticker, not bold cartoon art, not cloisonné.`
  );
}

// Acrylic keychains are PRINTED, not cast. The artwork needs to look great as a
// vibrant flat print — no metal-wall illusion, no 3D depth, just clean bold graphics.
function acrylicPrompt(mode: SubjectMode): string {
  const subj = mode === "all" ? "the whole drawing (all figures and elements)" : "that single main subject";
  return (
    isolation(mode) +
    `Turn ${subj} into a cute, vibrant sticker-style illustration perfect for printing onto a small acrylic keychain charm. ` +
    `Style: bold anime / kawaii sticker art — clean thick outlines (important for die-cut production), ` +
    `large flat areas of solid bright colour, no gradients, no metallic textures, no 3D effects. ` +
    `Colours should be vivid and saturated. The design should be centered on a PURE WHITE background with generous ` +
    `margin on all sides (the white background will be precision-cut away during production, so the thick outline ` +
    `clearly defines the charm shape). ` +
    `Do NOT add any metal bails, rings, chains or clasps — output ONLY the charm artwork. No text. ` +
    COLOR_ACCURACY +
    `The final result must look like a fun, cute printed sticker design — not a photo, not metalwork, not a sketch.`
  );
}

function promptFor(style: StyleId, metal: MetalTint, mode: SubjectMode, connection: ConnectMode): string {
  // Acrylic is material-driven regardless of style — always produces a flat print.
  if (metal === "acrylic") return acrylicPrompt(mode);
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
  // Default "enamel" style — route by material tier.
  // Silver is 925 sterling silver jewellery: fine-line minimalist engraving look.
  if (metal === "silver") return silverJewelryPrompt(mode);
  // Gold and rose-gold are printed metal badge charms (not cloisonné).
  return metalBadgePrompt(metal as "gold" | "rosegold", mode, connection);
}

export async function POST(req: NextRequest) {
  // Rate-limit before any expensive work; use x-forwarded-for set by Vercel.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const { allowed, retryAfter } = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `You've reached the limit of ${RATE_LIMIT} free previews per hour. Please try again later.`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

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
