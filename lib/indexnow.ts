import "server-only";
import { SITE } from "./site";

// IndexNow instantly notifies Bing / Yandex / Naver / Seznam (and feeds
// ChatGPT/Copilot search) when a URL is published or updated. The key is
// public by design and is also served at /<KEY>.txt.
// NOTE: Google does NOT support IndexNow — it relies on the sitemap + Search
// Console, so there is no instant-ping for Google here (by design, not a bug).
const KEY = "42d54d92f1da24ee0539bdff8bfd67ff";

/** Best-effort ping; never throws (publishing must not fail if this does). */
export async function pingIndexNow(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const host = new URL(SITE.url).host;
  const urlList = paths.map((p) => (p.startsWith("http") ? p : `${SITE.url}${p}`));
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE.url}/${KEY}.txt`, urlList }),
    });
  } catch {
    /* ignore — notification is best-effort */
  }
}
