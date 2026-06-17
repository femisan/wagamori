import { NextResponse } from "next/server";
import { likeShowcase } from "@/lib/db/showcase";

export const runtime = "nodejs";

// Anonymous like — the client dedupes per-device via localStorage.
export async function POST(req: Request) {
  let id: string | undefined;
  try {
    ({ id } = (await req.json()) as { id?: string });
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const likes = await likeShowcase(id);
  if (likes == null) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, likes });
}
