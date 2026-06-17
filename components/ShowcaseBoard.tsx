"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Show, SignInButton } from "@clerk/nextjs";
import { useI18n } from "./LangProvider";
import { fileToDataUrl, downscaleDataUrl } from "@/lib/stylize";

interface Post {
  id: string;
  imageUrl: string;
  sourceUrl: string | null;
  caption: string | null;
  authorName: string | null;
  likes: number;
  createdAt: string;
}

const PAGE = 24;
const LIKED_KEY = "wagamori-showcase-liked";

export default function ShowcaseBoard({ initial }: { initial: Post[] }) {
  const { t } = useI18n();
  const [posts, setPosts] = useState<Post[]>(initial);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState("");
  const [pieceFile, setPieceFile] = useState<File | null>(null);
  const [srcFile, setSrcFile] = useState<File | null>(null);
  const [piecePrev, setPiecePrev] = useState<string | null>(null);
  const [srcPrev, setSrcPrev] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initial.length >= PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const pieceInput = useRef<HTMLInputElement | null>(null);
  const srcInput = useRef<HTMLInputElement | null>(null);

  // Load the per-device "already liked" set so the heart stays filled.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIKED_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from localStorage
      if (raw) setLiked(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  const pick = useCallback(
    (file: File, which: "piece" | "src") => {
      if (!file.type.startsWith("image/")) {
        setError(t.showcase.errNotImage);
        return;
      }
      setError(null);
      const url = URL.createObjectURL(file);
      if (which === "piece") {
        setPieceFile(file);
        setPiecePrev(url);
      } else {
        setSrcFile(file);
        setSrcPrev(url);
      }
    },
    [t],
  );

  const post = useCallback(async () => {
    if (!pieceFile) return;
    setUploading(true);
    setError(null);
    try {
      const pieceData = await downscaleDataUrl(await fileToDataUrl(pieceFile), 1400, 0.85);
      const srcData = srcFile ? await downscaleDataUrl(await fileToDataUrl(srcFile), 1200, 0.85) : undefined;
      const res = await fetch("/api/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: pieceData, sourceDataUrl: srcData, caption: caption.trim() || undefined }),
      });
      const json = await res.json();
      if (json.ok && json.post) {
        setPosts((p) => [json.post as Post, ...p]);
        setCaption("");
        setPieceFile(null);
        setSrcFile(null);
        setPiecePrev(null);
        setSrcPrev(null);
      } else {
        setError(t.showcase.uploadFailed);
      }
    } catch {
      setError(t.showcase.uploadFailed);
    } finally {
      setUploading(false);
    }
  }, [pieceFile, srcFile, caption, t]);

  const like = useCallback(
    async (id: string) => {
      if (liked.has(id)) return;
      setPosts((p) => p.map((x) => (x.id === id ? { ...x, likes: x.likes + 1 } : x)));
      const next = new Set(liked).add(id);
      setLiked(next);
      try {
        localStorage.setItem(LIKED_KEY, JSON.stringify([...next]));
      } catch {}
      try {
        const res = await fetch("/api/showcase/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const json = await res.json();
        if (json.ok && typeof json.likes === "number") {
          setPosts((p) => p.map((x) => (x.id === id ? { ...x, likes: json.likes } : x)));
        }
      } catch {
        /* keep optimistic value */
      }
    },
    [liked],
  );

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/showcase?limit=${PAGE}&offset=${posts.length}`);
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setPosts((p) => [...p, ...(json.data as Post[])]);
        if (json.data.length < PAGE) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [posts.length]);

  return (
    <div>
      {/* Upload */}
      <div className="card mx-auto max-w-xl p-5 text-center">
        <h2 className="font-display text-xl">{t.showcase.shareTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.showcase.shareSub}</p>

        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="btn-primary mt-4 cursor-pointer rounded-full px-6 py-3 text-sm font-medium">
              {t.showcase.loginToPost}
            </button>
          </SignInButton>
        </Show>

        <Show when="signed-in">
          <div className="mt-4 grid grid-cols-2 gap-3">
            <PickerTile
              label={t.showcase.pieceLabel}
              preview={piecePrev}
              onClick={() => pieceInput.current?.click()}
            />
            <PickerTile
              label={t.showcase.sourceLabel}
              preview={srcPrev}
              optional
              onClick={() => srcInput.current?.click()}
            />
          </div>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={140}
            placeholder={t.showcase.captionPlaceholder}
            className="mt-3 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-gold"
          />
          <button
            onClick={post}
            disabled={uploading || !pieceFile}
            className="btn-primary mt-3 w-full cursor-pointer rounded-full px-6 py-3 text-sm font-medium disabled:opacity-50"
          >
            {uploading ? t.showcase.posting : t.showcase.postCta}
          </button>
          <p className="mt-2 text-xs text-muted">{t.showcase.uploadHint}</p>
        </Show>

        {error && <p className="mt-2 text-xs text-blush-deep">{error}</p>}
      </div>

      {/* Grid */}
      {posts.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">{t.showcase.empty}</p>
      ) : (
        <div className="mt-8 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
          {posts.map((p) => (
            <figure key={p.id} className="card break-inside-avoid overflow-hidden">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.caption || "buyer photo"} className="w-full object-cover" loading="lazy" />
                {p.sourceUrl && (
                  <div className="absolute bottom-2 right-2 w-1/4 min-w-[44px] max-w-[72px] rotate-3">
                    <div className="overflow-hidden rounded-lg border-2 border-white bg-white shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.sourceUrl} alt="original" className="aspect-square w-full object-cover" loading="lazy" />
                    </div>
                  </div>
                )}
              </div>
              <figcaption className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/80">
                    {p.authorName ? `${p.authorName}${t.showcase.nameSuffix}` : t.showcase.anonName}
                  </span>
                  <button
                    onClick={() => like(p.id)}
                    disabled={liked.has(p.id)}
                    aria-label={t.showcase.like}
                    className="flex shrink-0 cursor-pointer items-center gap-1 text-sm disabled:cursor-default"
                  >
                    <Heart filled={liked.has(p.id)} />
                    <span className="tabular-nums text-muted">{p.likes}</span>
                  </button>
                </div>
                {p.caption && <p className="mt-1 line-clamp-2 text-xs text-muted">{p.caption}</p>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {hasMore && posts.length > 0 && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-ghost cursor-pointer rounded-full px-6 py-3 text-sm disabled:opacity-50"
          >
            {loadingMore ? t.showcase.loading : t.showcase.loadMore}
          </button>
        </div>
      )}

      <input
        ref={pieceInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f, "piece");
          e.target.value = "";
        }}
      />
      <input
        ref={srcInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f, "src");
          e.target.value = "";
        }}
      />
    </div>
  );
}

function PickerTile({
  label,
  preview,
  optional = false,
  onClick,
}: {
  label: string;
  preview: string | null;
  optional?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed text-center transition ${
        preview ? "border-rose" : "border-line hover:border-gold-soft hover:bg-surface"
      }`}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span className="px-2 text-xs text-muted">
          <span className="block text-lg">＋</span>
          {label}
          {optional && <span className="mt-0.5 block text-[10px] opacity-70">任意 / optional</span>}
        </span>
      )}
    </button>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className={filled ? "" : "opacity-70"}>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={filled ? "var(--rose)" : "none"}
        stroke="var(--rose)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
