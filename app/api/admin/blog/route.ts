import { NextResponse } from "next/server";
import { canManage } from "@/lib/role";
import { adminListPosts, setPostStatus, deletePost } from "@/lib/db/posts";
import { pingIndexNow } from "@/lib/indexnow";

export const runtime = "nodejs";

export async function GET() {
  if (!(await canManage())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, data: await adminListPosts() });
}

export async function POST(req: Request) {
  if (!(await canManage())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { action, slug } = (await req.json()) as { action?: string; slug?: string };
  if (!slug) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  if (action === "publish") {
    const post = await setPostStatus(slug, "published");
    await pingIndexNow([`/blog/${slug}`, "/blog"]);
    return NextResponse.json({ ok: true, post });
  }
  if (action === "draft") return NextResponse.json({ ok: true, post: await setPostStatus(slug, "draft") });
  if (action === "delete") return NextResponse.json({ ok: await deletePost(slug) });
  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
