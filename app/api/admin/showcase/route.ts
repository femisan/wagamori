import { NextResponse } from "next/server";
import { canManage } from "@/lib/role";
import { adminListShowcase, setShowcaseStatus, deleteShowcasePost } from "@/lib/db/showcase";

export const runtime = "nodejs";

export async function GET() {
  if (!(await canManage())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const data = await adminListShowcase();
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  if (!(await canManage())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { action, id } = (await req.json()) as { action?: string; id?: string };
  if (!id) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  if (action === "hide") return NextResponse.json({ ok: true, post: await setShowcaseStatus(id, "hidden") });
  if (action === "show") return NextResponse.json({ ok: true, post: await setShowcaseStatus(id, "visible") });
  if (action === "delete") return NextResponse.json({ ok: await deleteShowcasePost(id) });
  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
