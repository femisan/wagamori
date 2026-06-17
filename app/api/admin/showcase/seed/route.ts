import { NextResponse } from "next/server";
import { createShowcasePost, deleteSeedPosts } from "@/lib/db/showcase";
import { putDataUrl } from "@/lib/blob";

export const runtime = "nodejs";
export const maxDuration = 120;

// One-off seeding of buyer-show posts (real product photos + realistic accounts).
// ADMIN_TOKEN-gated. Body:
//   { reset?: boolean, items: [{ dataUrl, sourceDataUrl?, caption, authorName, metal, likes }] }
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let items: Array<{ dataUrl: string; sourceDataUrl?: string; caption?: string; authorName?: string; metal?: string; likes?: number }>;
  let reset = false;
  try {
    ({ items, reset } = await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: "no_items" }, { status: 400 });
  }

  let removed = 0;
  if (reset) removed = await deleteSeedPosts();

  const created: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it?.dataUrl?.startsWith("data:image/")) continue;
    const imageUrl = await putDataUrl(it.dataUrl, "showcase-seed");
    if (!imageUrl) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 });
    const sourceUrl = it.sourceDataUrl?.startsWith("data:image/")
      ? await putDataUrl(it.sourceDataUrl, "showcase-seed-src")
      : null;
    const post = await createShowcasePost({
      userId: `seed_${i + 1}`,
      authorName: it.authorName || null,
      imageUrl,
      sourceUrl,
      caption: it.caption || null,
      metal: it.metal || null,
      likes: typeof it.likes === "number" ? it.likes : 0,
    });
    if (!post) return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 503 });
    created.push(post.id);
  }

  return NextResponse.json({ ok: true, removed, created });
}
