import type { MetalId, StyleId } from "./products";

// RGB of the metal divider walls used in the cloisonné fallback.
const METAL_RGB: Record<MetalId, [number, number, number]> = {
  gold: [232, 192, 90],
  silver: [205, 209, 212],
  rosegold: [224, 168, 153],
};

/**
 * Client-side fallback "stylization" used when the AI route is unavailable.
 * It won't match gpt-image-1, but it gives an instant, on-brand preview so the
 * funnel never shows a broken state. Returns a square data URL.
 *
 * For the "enamel" style it mimics the real product: flat colour cells
 * separated by metal divider walls (cloisonné) with a fine sandy grain inside,
 * because the colours are UV-resin + coloured sand divided by metal.
 */
export async function stylizeOnCanvas(
  src: string,
  style: StyleId,
  metal: MetalId = "gold",
  size = 768,
): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // cover-crop into square
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

  const data = ctx.getImageData(0, 0, size, size);
  const p = data.data;

  if (style === "engraved") {
    // grayscale + high contrast → etched look
    for (let i = 0; i < p.length; i += 4) {
      const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      const c = clamp((g - 128) * 1.5 + 128);
      p[i] = p[i + 1] = p[i + 2] = c;
    }
  } else {
    // enamel / photo: boost saturation + posterize to flat cheerful colors
    const levels = style === "enamel" ? 5 : 12;
    const step = 255 / (levels - 1);
    for (let i = 0; i < p.length; i += 4) {
      let r = p[i];
      let g = p[i + 1];
      let b = p[i + 2];
      // saturation boost
      const avg = (r + g + b) / 3;
      const sat = style === "enamel" ? 1.6 : 1.15;
      r = clamp(avg + (r - avg) * sat);
      g = clamp(avg + (g - avg) * sat);
      b = clamp(avg + (b - avg) * sat);
      // posterize into flat colour blocks
      r = Math.round(Math.round(r / step) * step);
      g = Math.round(Math.round(g / step) * step);
      b = Math.round(Math.round(b / step) * step);
      // sandy grain inside the resin cells (enamel only)
      if (style === "enamel") {
        const n = (Math.random() - 0.5) * 26;
        r = clamp(r + n);
        g = clamp(g + n);
        b = clamp(b + n);
      }
      p[i] = r;
      p[i + 1] = g;
      p[i + 2] = b;
    }

    // Draw metal divider walls between adjacent colour cells (cloisonné).
    if (style === "enamel") {
      drawMetalWalls(p, size, step, metal);
    }
  }
  ctx.putImageData(data, 0, 0);

  // soft white vignette so it sits nicely in the bezel
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.32, size / 2, size / 2, size * 0.52);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(255,253,248,0.85)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return canvas.toDataURL("image/png");
}

/**
 * Paint thin metal divider walls wherever two flat colour cells meet — the
 * defining feature of cloisonné: no two colours touch, a metal wall sits
 * between them (and around the whole subject against the white background).
 */
function drawMetalWalls(
  p: Uint8ClampedArray,
  size: number,
  step: number,
  metal: MetalId,
): void {
  const [mr, mg, mb] = METAL_RGB[metal] ?? METAL_RGB.gold;
  const bucket = (i: number, ch: number) => Math.round(p[i + ch] / step);
  const edges = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const rb = bucket(i, 0), gb = bucket(i, 1), bb = bucket(i, 2);
      // compare with right + bottom neighbours
      if (x + 1 < size) {
        const j = i + 4;
        if (bucket(j, 0) !== rb || bucket(j, 1) !== gb || bucket(j, 2) !== bb) {
          edges[y * size + x] = 1;
        }
      }
      if (y + 1 < size) {
        const j = i + size * 4;
        if (bucket(j, 0) !== rb || bucket(j, 1) !== gb || bucket(j, 2) !== bb) {
          edges[y * size + x] = 1;
        }
      }
    }
  }

  // Paint walls ~2px thick (pixel + right + bottom) with a tiny metallic sheen.
  const paint = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const sheen = (Math.random() - 0.5) * 24;
    p[i] = clamp(mr + sheen);
    p[i + 1] = clamp(mg + sheen);
    p[i + 2] = clamp(mb + sheen);
    p[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (edges[y * size + x]) {
        paint(x, y);
        paint(x + 1, y);
        paint(x, y + 1);
      }
    }
  }
}

/**
 * Downscale a data URL so it stays well under the serverless request-body limit
 * (large phone photos as base64 can exceed it). Returns a JPEG data URL.
 */
export async function downscaleDataUrl(src: string, max = 1200, quality = 0.85): Promise<string> {
  try {
    const img = await loadImage(src);
    let w = img.width;
    let h = img.height;
    if (Math.max(w, h) > max) {
      const s = max / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return src; // if anything fails, fall back to the original
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
