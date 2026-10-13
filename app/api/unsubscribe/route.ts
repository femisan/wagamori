import { NextResponse } from "next/server";
import { verifyUnsubscribe } from "@/lib/marketing";
import { unsubscribe } from "@/lib/db/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function params(req: Request) {
  const u = new URL(req.url);
  return { email: (u.searchParams.get("e") || "").trim().toLowerCase(), token: u.searchParams.get("t") || "" };
}

// RFC 8058 one-click unsubscribe (mail clients POST here) + the confirm-page form.
export async function POST(req: Request) {
  const { email, token } = params(req);
  if (!email || !verifyUnsubscribe(email, token)) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  await unsubscribe(email);
  // Our confirm page posts `from=page` and expects to land back on it; one-click
  // mail clients post `List-Unsubscribe=One-Click` and just need a 2xx.
  const body = await req.text().catch(() => "");
  if (new URLSearchParams(body).get("from") === "page") {
    return NextResponse.redirect(new URL("/unsubscribe?done=1", req.url), 303);
  }
  return NextResponse.json({ ok: true });
}

// Opening the header URL in a browser → go to the confirm page (never unsubscribe on GET).
export async function GET(req: Request) {
  const u = new URL(req.url);
  return NextResponse.redirect(new URL(`/unsubscribe?${u.searchParams.toString()}`, req.url), 303);
}
