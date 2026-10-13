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
import { enamelPrompt, refinePrompt, type ConnectMode, type SubjectMode } from "@/lib/prompts";

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
      // DB trouble must never block the free preview — the per-IP limit below still applies.
      const used = await anonAttemptCount(actor.anonId).catch((e) => {
        console.error("[generate] anon attempt check failed:", e instanceof Error ? e.message : e);
        return 0;
      });
      if (designIdIn || used >= 1) {
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
      } catch (e) {
        // Storage/DB unavailable — still return a preview, just without history.
        console.error("[generate] saving original failed:", e instanceof Error ? e.message : e);
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
      } catch (e) {
        // History save failed — the preview still returns.
        console.error("[generate] saving version failed:", e instanceof Error ? e.message : e);
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
    console.error("[generate] failed:", message);
    // Real failure (quota, content policy, timeout…) — report it; the client shows
    // a retry message instead of a fake canvas preview.
    return NextResponse.json({ ok: false, error: "generation_failed" }, { status: 502 });
  }
}
