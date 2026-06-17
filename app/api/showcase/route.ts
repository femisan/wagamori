import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createShowcasePost, listShowcase } from "@/lib/db/showcase";
import { putDataUrl } from "@/lib/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

// Public list of buyer-show posts (visible only).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(48, Math.max(1, Number(sp.get("limit")) || 24));
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const data = await listShowcase(limit, offset);
  return NextResponse.json({ ok: true, data });
}

// Upload a buyer-show photo. Login required (anti-spam / accountability).
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { dataUrl?: string; sourceDataUrl?: string; caption?: string; metal?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const { dataUrl, sourceDataUrl, caption, metal } = body;
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return NextResponse.json({ ok: false, error: "no_image" }, { status: 400 });
  }

  const imageUrl = await putDataUrl(dataUrl, "showcase");
  if (!imageUrl) {
    return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 });
  }
  // Optional original drawing/photo, shown as a small inset on the card.
  const sourceUrl =
    sourceDataUrl?.startsWith("data:image/") ? await putDataUrl(sourceDataUrl, "showcase-src") : null;

  const u = await currentUser();
  const authorName =
    u?.firstName || u?.username || (u?.fullName ?? "").split(" ")[0] || null;

  const post = await createShowcasePost({
    userId,
    authorName,
    imageUrl,
    sourceUrl,
    caption: caption?.slice(0, 140) || null,
    metal: metal || null,
  });
  if (!post) return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 503 });

  return NextResponse.json({ ok: true, post });
}
