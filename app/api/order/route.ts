import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Persists the customer's artwork before checkout so the seller can fulfil the
 * order (e.g. forward to the Taobao maker). Returns a public URL for the image
 * that is then attached to the Stripe Checkout session metadata.
 *
 * If Vercel Blob is not configured (no BLOB_READ_WRITE_TOKEN), we degrade
 * gracefully and return the data URL straight back so the flow never breaks —
 * add a Blob store in production to capture artwork reliably.
 */
export async function POST(req: Request) {
  try {
    const { dataUrl, kind = "preview" } = await req.json();
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      return NextResponse.json({ ok: false, error: "Invalid image." }, { status: 400 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ ok: true, url: dataUrl, stored: false });
    }

    const match = dataUrl.match(/^data:(.+?);base64,(.*)$/);
    if (!match) {
      return NextResponse.json({ ok: false, error: "Bad data URL." }, { status: 400 });
    }
    const [, mime, b64] = match;
    const ext = mime.split("/")[1]?.split("+")[0] || "png";
    const bytes = Buffer.from(b64, "base64");
    const ts = Date.now();
    const blob = await put(`orders/${kind}-${ts}.${ext}`, bytes, {
      access: "public",
      contentType: mime,
    });

    return NextResponse.json({ ok: true, url: blob.url, stored: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
