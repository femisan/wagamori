import { NextResponse } from "next/server";
import { canManage } from "@/lib/role";
import { getVersions, adminSetSelected, addVersion, nextRound } from "@/lib/db/designs";
import { putDataUrl } from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Version history for one design (the list itself comes from /api/admin/leads).
export async function GET(req: Request) {
  if (!(await canManage())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  return NextResponse.json({ ok: true, versions: await getVersions(id) });
}

export async function POST(req: Request) {
  if (!(await canManage())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const b = (await req.json()) as {
    action?: "select" | "upload";
    designId?: string;
    versionId?: string;
    dataUrl?: string;
    instruction?: string;
  };

  if (b.action === "select" && b.designId && b.versionId) {
    await adminSetSelected(b.designId, b.versionId);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "upload" && b.designId && b.dataUrl?.startsWith("data:")) {
    const url = await putDataUrl(b.dataUrl, "cs");
    if (!url) return NextResponse.json({ ok: false, error: "blob_failed" }, { status: 500 });
    await addVersion({
      designId: b.designId,
      round: await nextRound(b.designId),
      source: "cs",
      instruction: (b.instruction || "CS作成デザイン").slice(0, 300),
      imageUrl: url,
    });
    return NextResponse.json({ ok: true, imageUrl: url });
  }
  return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
}
