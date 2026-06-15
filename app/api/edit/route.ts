import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { requireEditAccess } from "@/lib/edit-access";

export const runtime = "nodejs";
export const maxDuration = 120;

const METAL_WORD: Record<string, string> = {
  gold: "shiny gold",
  silver: "bright polished silver",
  rosegold: "soft rose-gold",
};

/**
 * Conversational refinement of an existing pendant preview. Takes the current
 * image + a plain-language instruction and re-renders, keeping the cloisonné
 * style. Login-gated (and rate-limited) once Clerk is configured.
 */
export async function POST(req: Request) {
  try {
    const { image, instruction, metal } = (await req.json()) as {
      image?: string;
      instruction?: string;
      metal?: string;
    };

    if (!image?.startsWith("data:") || !instruction?.trim()) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }

    // Login required + per-user daily rate limit.
    const access = await requireEditAccess();
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.reason },
        { status: access.reason === "rate_limited" ? 429 : 401 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "no_api_key" }, { status: 503 });

    const wall = METAL_WORD[metal || "gold"] ?? METAL_WORD.gold;
    const prompt =
      `You are refining an existing handcrafted cloisonné enamel jewelry pendant image. Apply ONLY the change the ` +
      `customer asks for and keep everything else the same. Customer request: "${instruction.slice(0, 300)}". ` +
      `Keep the cloisonné style intact: every area of colour fully enclosed by thin raised ${wall} metal divider lines, ` +
      `no two colours touching, coloured-sand + glossy UV resin fill, flat colour blocks, a pure clean WHITE background, ` +
      `exactly one small gold bail loop at the top attached to the piece, and NO floating/detached rings. Keep all other ` +
      `colours faithful to the current image and do not add a yellow/warm tint. No text.`;

    const match = image.match(/^data:(.+?);base64,(.*)$/);
    if (!match) return NextResponse.json({ ok: false, error: "bad_image" }, { status: 400 });
    const buf = Buffer.from(match[2], "base64");
    const file = await toFile(buf, "current.png", { type: match[1] || "image/png" });

    const openai = new OpenAI({ apiKey });
    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: file,
      prompt,
      size: "1024x1024",
      quality: "medium",
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ ok: false, error: "empty" }, { status: 502 });

    return NextResponse.json({ ok: true, image: `data:image/png;base64,${b64}`, remaining: access.remaining });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Edit failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
