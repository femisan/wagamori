// Client-only: compose a single shareable image — the big necklace preview with
// the customer's own photo tucked into the bottom-right corner — so they can save
// it and share with friends. Returns a PNG data URL.

export interface ShareImageOpts {
  preview: string; // pendant art (data URL or same-origin URL)
  original?: string; // the customer's uploaded photo
  brand?: string; // wordmark (default WAGAMORI)
  tagline?: string; // caption under the pendant
  engraving?: string; // overrides tagline if present
  yourPhotoLabel?: string; // label under the inset photo
}

const SIZE = 1080;

export async function composeShareImage(opts: ShareImageOpts): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  // ---- background: soft sakura wash ----
  ctx.fillStyle = "#fdf4f2";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const bg = ctx.createRadialGradient(SIZE * 0.8, 0, 0, SIZE * 0.8, 0, SIZE);
  bg.addColorStop(0, "rgba(253,227,230,0.9)");
  bg.addColorStop(1, "rgba(253,244,242,0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ---- wordmark ----
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "10px";
  } catch {}
  ctx.fillStyle = "#d2a235";
  ctx.font = "600 44px Georgia, 'Times New Roman', serif";
  ctx.fillText((opts.brand || "WAGAMORI").toUpperCase(), SIZE / 2, 96);
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
  } catch {}

  // ---- pendant (big) ----
  const cx = SIZE / 2;
  const cy = SIZE / 2 + 18;
  const R = 322;

  // bail loop
  ctx.save();
  ctx.strokeStyle = "#d2a235";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(cx, cy - R - 26, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // metal bezel disc
  const bezel = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  bezel.addColorStop(0, "#fbeebc");
  bezel.addColorStop(0.52, "#e2b53c");
  bezel.addColorStop(1, "#b88a26");
  ctx.save();
  ctx.shadowColor = "rgba(120,90,30,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = bezel;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // inner white well
  ctx.fillStyle = "#fffdf8";
  ctx.beginPath();
  ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
  ctx.fill();

  // preview art clipped into the well
  const preview = await loadImage(opts.preview);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  drawCover(ctx, preview, cx - R, cy - R, R * 2, R * 2);
  // glassy highlight
  const gloss = ctx.createLinearGradient(cx - R, cy - R, cx, cy);
  gloss.addColorStop(0, "rgba(255,255,255,0.45)");
  gloss.addColorStop(0.4, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();

  // ---- caption ----
  const caption = opts.engraving ? `“${opts.engraving}”` : opts.tagline || "";
  if (caption) {
    ctx.fillStyle = "#4a2530";
    ctx.font = "italic 500 34px Georgia, serif";
    ctx.fillText(caption, SIZE / 2, cy + R + 78);
  }

  // ---- original photo inset (bottom-right, polaroid style) ----
  if (opts.original) {
    const original = await loadImage(opts.original);
    const S = 236;
    const pad = 16;
    const cardW = S + pad * 2;
    const cardH = S + pad * 2 + 30;
    const ix = SIZE - cardW - 40;
    const iy = SIZE - cardH - 40;
    ctx.save();
    ctx.translate(ix + cardW / 2, iy + cardH / 2);
    ctx.rotate((4 * Math.PI) / 180);
    ctx.translate(-(cardW / 2), -(cardH / 2));
    // white card + shadow
    ctx.shadowColor = "rgba(74,37,48,0.28)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 0, 0, cardW, cardH, 16);
    ctx.fill();
    ctx.shadowColor = "transparent";
    // photo
    ctx.save();
    roundRect(ctx, pad, pad, S, S, 10);
    ctx.clip();
    drawCover(ctx, original, pad, pad, S, S);
    ctx.restore();
    // label
    if (opts.yourPhotoLabel) {
      ctx.fillStyle = "#9b7a80";
      ctx.font = "500 20px system-ui, sans-serif";
      ctx.fillText(opts.yourPhotoLabel, cardW / 2, pad + S + 18);
    }
    ctx.restore();
  }

  return canvas.toDataURL("image/png");
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  // For remote (http) URLs, fetch to a same-origin object URL so the canvas is
  // never tainted (and we avoid passing huge data URLs through props/SSR).
  let url = src;
  let revoke = false;
  if (/^https?:/i.test(src)) {
    const blob = await (await fetch(src)).blob();
    url = URL.createObjectURL(blob);
    revoke = true;
  }
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    if (revoke) URL.revokeObjectURL(url);
  }
}
