import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import OpenAI, { toFile } from "openai";
import { getActor } from "@/lib/actor";
import { requireEditAccess } from "@/lib/edit-access";
import { putDesignBytes } from "@/lib/blob";
import {
  addVersion,
  anonAttemptCount,
  claimAnonDesigns,
  createDesign,
  getDesignForActor,
  getVersion,
  nextRound,
  touchDesign,
} from "@/lib/db/designs";
import { setMarketingConsent } from "@/lib/db/leads";
import { isMetal, type MetalId } from "@/lib/products";

// Every preview is ONE generation from a reference the customer chooses:
//   - "original" (default for a fresh attempt) — regenerated from the upload, no drift;
//   - a version id — refine THAT version with the customer's wish (e.g. "go back to
//     version 2 and make the face bigger").
//   - Guests get exactly one free preview (saved under an anonymous cookie).
//   - Signed-in users can try again as often as the daily cap allows, optionally
//     adding a short "wish". Their first guest preview is claimed on login.
// The original and every attempt are kept in Blob + DB for the customer, CS,
// and the admin leads view.

// Per-IP rate limit for guests: N requests per hour before gpt-image-1 is called.
const RATE_LIMIT = 3;
const IMAGE_QUALITY = "high" as const;

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

// How many of the drawn subjects to keep.
type SubjectMode = "solo" | "all";
// How multiple figures are assembled into one piece.
type ConnectMode = "joined" | "linked";

// Assembly + bail instructions (also fixes stray floating rings).
function assembly(mode: SubjectMode, connection: ConnectMode, wall: string): string {
  const noFloat =
    " CRITICAL: do NOT add any stray, floating or detached metal ring — every loop/ring must be physically attached to a figure or to a chain. ";
  if (mode !== "all") {
    return (
      ` Attach exactly ONE small ${wall} bail loop at the very top of the charm, physically connected to the top of the artwork (never floating separately).` +
      noFloat
    );
  }
  if (connection === "linked") {
    return (
      " ASSEMBLY: make each figure its OWN separate flat charm, then connect the charms side by side in a single " +
      `horizontal row using small ${wall} jump rings and short chain segments between adjacent charms (like a ` +
      "connected charm piece). Each charm has its own small attachment loop on its side; the short chains link the " +
      "charms together into one continuous piece. No charm and no ring floats unattached." +
      noFloat
    );
  }
  return (
    " ASSEMBLY: combine ALL the figures into ONE single connected charm — the figures touch, overlap or share one " +
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

// Metal used for the cloisonné divider walls, outline and bail.
const METAL_WORD: Record<MetalId, string> = {
  gold: "shiny gold",
  rosegold: "soft rose-gold",
  silver: "bright polished sterling-silver",
};

// Cloisonné-specific colour fidelity — divider lines are metallic, fills must match original.
function colorFidelity(wall: string): string {
  return (
    "COLOUR ACCURACY (very important): faithfully reproduce the EXACT colours of the original artwork — keep every hue " +
    "true to what was actually drawn (blue stays blue, red stays red, brown hair stays brown, plain/cream paper areas " +
    "become clean neutral white). Do NOT add any yellow, golden, warm or sepia tint to the colour fills and do not shift " +
    `or recolour the palette. ONLY the thin divider lines are ${wall} metal; every colour inside the cells must match the ` +
    "original drawing's colours. "
  );
}

// The one product the preview renders: a colourful cloisonné enamel charm.
// Only the metal (walls / outline / bail) changes with the chosen material.
function enamelPrompt(metal: MetalId, mode: SubjectMode, connection: ConnectMode, wish: string): string {
  const wall = METAL_WORD[metal];
  const subj = mode === "all" ? "the whole drawing (all the figures and elements together)" : "that single subject";
  return (
    isolation(mode) +
    `Turn ${subj} into a real handcrafted cloisonné-style colourful enamel metal charm, in TWO steps. ` +
    `STEP 1 — STYLISE (CRITICAL): COMPLETELY abandon any photographic or realistic rendering. ` +
    `Whether the input is a photo or a drawing, convert it entirely into a bold flat-colour-block cartoon illustration: ` +
    `reduce everything to large areas of pure solid flat colour, clean simple outlines, ZERO photographic gradients, ` +
    `ZERO shadows, ZERO fur/hair texture, ZERO realistic shading. The result of Step 1 must be fully 2D — ` +
    `think of a simple anime sticker or a flat kawaii illustration. ` +
    (mode === "all" ? `Arrange ALL the figures/elements together as one balanced composition. ` : ``) +
    `STEP 2 — CLOISONNÉ: every flat colour area from Step 1 must be fully enclosed by thin raised ${wall} metal ` +
    `divider lines (cloisonné wires). No two colours ever touch directly — there is ALWAYS a thin ${wall} metal wall ` +
    `between one colour and the next, and around the outside of every shape. Fill each metal-walled cell with fine ` +
    `coloured sand set in clear glossy UV resin: a subtle granular sandy texture with a wet, glassy resin sheen. ` +
    `Flat colour blocks divided by metal, centered on a pure clean WHITE background with generous margin. ` +
    `No gradients inside a cell, no text. ` +
    assembly(mode, connection, wall) +
    colorFidelity(wall) +
    (wish
      ? `CUSTOMER WISH for this version (apply it, but keep every rule above): "${wish}". `
      : "") +
    `CRITICAL FINAL CHECK: the output must NOT look like a photograph or a realistic portrait in any way. ` +
    `It must look like an actual handcrafted cloisonné metal-and-resin enamel charm with visible ${wall} wire outlines.`
  );
}

// Refine an EXISTING version (customer chose "edit this version" — e.g. to go
// back to an earlier one and tweak it). Keep the art; apply only the wish.
function refinePrompt(metal: MetalId, wish: string, metalChanged: boolean): string {
  const wall = METAL_WORD[metal];
  return (
    `You are refining an existing handcrafted cloisonné enamel metal charm image. Apply ONLY the change the customer ` +
    `asks for and keep everything else exactly the same — same subject, pose, composition, outlines and colours. ` +
    `Customer request: "${wish}". ` +
    (metalChanged
      ? `Also re-render every metal divider wire, the outline and the bail in ${wall} metal (only the metal changes). `
      : "") +
    `Keep the cloisonné style intact: every area of colour fully enclosed by thin raised ${wall} metal divider lines, ` +
    `no two colours touching, coloured-sand + glossy UV resin fill, flat colour blocks, a pure clean WHITE background, ` +
    `exactly one small ${wall} bail loop attached to the piece, and NO floating/detached rings. Keep all other colours ` +
    `faithful to the current image and do not add a yellow/warm tint. Never add subjects that are not already there. No text.`
  );
}

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image");
    const designIdIn = (form.get("designId") as string) || "";
    const metalRaw = form.get("metal");
    const metal: MetalId = isMetal(metalRaw) ? metalRaw : "gold";
    const subjects: SubjectMode = form.get("subjects") === "all" ? "all" : "solo";
    const connection: ConnectMode = form.get("connection") === "joined" ? "joined" : "linked";
    const optInRaw = form.get("optIn");
    // Reference image: "original" (default) or the id of a version to refine.
    const baseRaw = ((form.get("base") as string) || "original").trim();
    // Validate before spending the user's daily quota.
    if (baseRaw !== "original" && !((form.get("wish") as string) || "").trim()) {
      return NextResponse.json({ ok: false, error: "wish_required" }, { status: 400 });
    }

    const actor = await getActor();

    // ---- access: one free guest preview; more needs an account ----
    let remaining: number | null = null;
    if (!actor.userId) {
      if (designIdIn || (await anonAttemptCount(actor.anonId)) >= 1) {
        return NextResponse.json({ ok: false, error: "login_required" }, { status: 401 });
      }
      const { allowed, retryAfter } = await checkRateLimit(clientIp(req));
      if (!allowed) {
        return NextResponse.json(
          { ok: false, error: "rate_limited" },
          { status: 429, headers: { "Retry-After": String(retryAfter) } },
        );
      }
    } else {
      const access = await requireEditAccess();
      if (!access.ok) {
        return NextResponse.json(
          { ok: false, error: access.reason },
          { status: access.reason === "rate_limited" ? 429 : 401 },
        );
      }
      remaining = access.remaining;
      await claimAnonDesigns(actor.anonId, actor.userId, actor.email).catch(() => {});
    }
    // Wishes are a signed-in feature; guests get the plain first preview.
    const wish = actor.userId ? ((form.get("wish") as string) || "").trim().slice(0, 200) : "";

    // ---- resolve the ORIGINAL image (always the source of every attempt) ----
    let design = designIdIn ? await getDesignForActor(designIdIn, actor) : null;
    if (designIdIn && !design) {
      return NextResponse.json({ ok: false, error: "design_not_found" }, { status: 404 });
    }

    // Refining a version: it must belong to this design, and needs a wish.
    let baseVersion: Awaited<ReturnType<typeof getVersion>> = null;
    if (baseRaw !== "original") {
      if (!design) return NextResponse.json({ ok: false, error: "design_not_found" }, { status: 404 });
      baseVersion = await getVersion(baseRaw);
      if (!baseVersion || baseVersion.designId !== design.id) {
        return NextResponse.json({ ok: false, error: "base_not_found" }, { status: 404 });
      }
      if (!wish) return NextResponse.json({ ok: false, error: "wish_required" }, { status: 400 });
    }

    let originalBytes: Buffer;
    let originalType: string;
    if (baseVersion) {
      const r = await fetch(baseVersion.imageUrl);
      if (!r.ok) return NextResponse.json({ ok: false, error: "base_missing" }, { status: 410 });
      originalBytes = Buffer.from(await r.arrayBuffer());
      originalType = r.headers.get("content-type") || "image/png";
    } else if (design?.originalUrl) {
      const r = await fetch(design.originalUrl);
      if (!r.ok) return NextResponse.json({ ok: false, error: "original_missing" }, { status: 410 });
      originalBytes = Buffer.from(await r.arrayBuffer());
      originalType = r.headers.get("content-type") || "image/png";
    } else if (file instanceof Blob) {
      originalBytes = Buffer.from(await file.arrayBuffer());
      originalType = file.type || "image/png";
    } else {
      return NextResponse.json({ ok: false, error: "no_image" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // No key configured — tell the client to use its local canvas fallback.
      return NextResponse.json({ ok: false, fallback: true, reason: "no_api_key" });
    }

    // First attempt on a new upload → keep the original before spending on AI.
    if (!design) {
      try {
        const originalUrl = await putDesignBytes(originalBytes, "original", originalType);
        if (originalUrl) {
          design = await createDesign({
            userId: actor.userId,
            anonId: actor.anonId,
            email: actor.email,
            originalUrl,
            metal,
          });
        }
      } catch {
        /* storage unavailable — still return a preview, just without history */
      }
    }

    const openai = new OpenAI({ apiKey });
    const image = await toFile(originalBytes, baseVersion ? "current.png" : "original.png", { type: originalType });
    const prompt = baseVersion
      ? refinePrompt(metal, wish, !!baseVersion.metal && baseVersion.metal !== metal)
      : enamelPrompt(metal, subjects, connection, wish);
    const result = await openai.images.edit({
      model: "gpt-image-1",
      image,
      prompt,
      size: "1024x1024",
      quality: IMAGE_QUALITY,
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ ok: false, fallback: true, reason: "empty" });
    }
    const dataUrl = `data:image/png;base64,${b64}`;

    // ---- save this attempt (best-effort; never block the preview) ----
    let versionId: string | null = null;
    let imageUrl: string | null = null;
    let round = 0;
    if (design) {
      try {
        imageUrl = await putDesignBytes(Buffer.from(b64, "base64"), "v", "image/png");
        if (imageUrl) {
          round = await nextRound(design.id);
          const v = await addVersion({
            designId: design.id,
            round,
            source: "ai",
            instruction: wish || null,
            baseVersionId: baseVersion?.id ?? null,
            imageUrl,
            style: "enamel",
            metal,
            subjects,
            connection,
          });
          versionId = v?.id ?? null;
        }
        await touchDesign(design.id, { email: actor.email, metal });
        if (actor.userId && actor.email && (optInRaw === "1" || optInRaw === "0")) {
          await setMarketingConsent(actor.email, actor.userId, optInRaw === "1");
        }
      } catch {
        /* history save failed — the preview still returns */
      }
    }

    return NextResponse.json({
      ok: true,
      image: imageUrl ?? dataUrl,
      designId: design?.id ?? null,
      versionId,
      round,
      metal,
      wish: wish || null,
      baseVersionId: baseVersion?.id ?? null,
      remaining,
      signedIn: !!actor.userId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    // Any failure (quota, content, timeout) → client falls back gracefully.
    return NextResponse.json({ ok: false, fallback: true, error: message });
  }
}
