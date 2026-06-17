import "server-only";
import { put } from "@vercel/blob";

/** Persist a data URL to Vercel Blob and return its public URL (or null). */
export async function putDataUrl(dataUrl: string, kind = "img"): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) return null;
  const [, mime, b64] = m;
  const ext = mime.split("/")[1]?.split("+")[0] || "png";
  const bytes = Buffer.from(b64, "base64");
  const rand = Math.random().toString(36).slice(2, 8);
  const blob = await put(`designs/${kind}-${Date.now()}-${rand}.${ext}`, bytes, {
    access: "public",
    contentType: mime,
  });
  return blob.url;
}
