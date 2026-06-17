import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { setSelectedVersion } from "@/lib/db/designs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { designId, versionId } = (await req.json()) as { designId?: string; versionId?: string };
  if (!designId || !versionId) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const ok = await setSelectedVersion(designId, userId, versionId);
  return NextResponse.json({ ok });
}
