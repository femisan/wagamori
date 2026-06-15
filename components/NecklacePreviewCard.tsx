"use client";

import { type MetalId, type StyleId } from "@/lib/products";
import { useI18n } from "./LangProvider";

interface Props {
  /** Image to show inside the pendant (AI-stylized art or photo). */
  src?: string | null;
  metal?: MetalId;
  style?: StyleId;
  engraving?: string;
  /** Show the loading shimmer instead of the image. */
  loading?: boolean;
  className?: string;
}

const METAL_GRAD: Record<MetalId, string> = {
  gold: "linear-gradient(135deg,#fbeebc,#e2b53c 52%,#b88a26)",
  silver: "linear-gradient(135deg,#eef1f3,#aab0b4 55%,#7c8388)",
  rosegold: "linear-gradient(135deg,#f3d3c8,#d89a89 55%,#b06f5e)",
};

/**
 * The keepsake "gift card" preview. Mirrors the reference: a clean card with the
 * brand wordmark, a gold chain hanging into a bezel-set pendant that holds the
 * customer's art, and an emotional caption.
 */
export default function NecklacePreviewCard({
  src,
  metal = "gold",
  style = "enamel",
  engraving,
  loading = false,
  className = "",
}: Props) {
  const { t } = useI18n();
  const bezel = METAL_GRAD[metal];
  const metalLabel = t.product.metals[metal]?.label ?? "";

  return (
    <div
      className={`relative mx-auto w-full max-w-[360px] select-none ${className}`}
      aria-label="Necklace preview card"
    >
      <div className="card relative overflow-hidden px-6 pb-7 pt-6 shadow-[0_30px_60px_-25px_rgba(110,84,40,0.45)]">
        {/* paper texture sheen */}
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(120%_60%_at_50%_-10%,#fff,transparent_60%)]" />

        {/* Brand header */}
        <div className="relative flex items-center justify-center gap-2 pb-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--rose)" }} />
          <span className="font-display text-[13px] tracking-[0.22em] text-foreground/80">
            WAGAMORI
          </span>
        </div>

        {/* Chain + pendant */}
        <div className="relative mt-1 flex flex-col items-center">
          <Chain bezel={bezel} />

          <div className="animate-sway -mt-[2px]">
            {/* bezel ring */}
            <div
              className="relative grid h-44 w-44 place-items-center rounded-full p-[7px] shadow-[0_14px_30px_-12px_rgba(80,60,20,0.55)]"
              style={{ background: bezel }}
            >
              {/* inner art well */}
              <div className="relative h-full w-full overflow-hidden rounded-full bg-[#fffdf8] ring-1 ring-black/5">
                {loading ? (
                  <div className="skeleton h-full w-full" />
                ) : src ? (
                  <img
                    src={src}
                    alt="Your custom pendant art"
                    className="h-full w-full object-cover"
                    style={style === "engraved" ? { filter: "grayscale(1) contrast(1.15)" } : undefined}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center text-muted">
                    <HeartIcon />
                    <span className="px-6 text-[11px] leading-tight">
                      {t.cardPlaceholder}
                    </span>
                  </div>
                )}
                {/* glassy highlight */}
                <div className="pointer-events-none absolute inset-0 [background:linear-gradient(135deg,rgba(255,255,255,0.5),transparent_40%)]" />
              </div>
              {/* bail (loop) */}
              <div
                className="absolute -top-3 left-1/2 h-5 w-3 -translate-x-1/2 rounded-full border-[3px]"
                style={{ borderColor: "var(--gold)" }}
              />
            </div>
          </div>
        </div>

        {/* Caption */}
        <div className="relative mt-5 text-center">
          {engraving ? (
            <p className="font-display text-lg italic text-foreground/85">“{engraving}”</p>
          ) : (
            <p className="font-display text-lg italic text-foreground/85">
              {t.cardCaption}
            </p>
          )}
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted">
            {metalLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

function Chain({ bezel }: { bezel: string }) {
  // A small V of beads forming the chain down to the pendant bail.
  const beads = 9;
  return (
    <svg width="240" height="74" viewBox="0 0 240 74" className="overflow-visible">
      {Array.from({ length: beads }).map((_, i) => {
        const t = i / (beads - 1);
        const x = 6 + t * (240 - 12);
        // parabola dipping to center
        const y = 6 + Math.pow((t - 0.5) * 2, 2) * 0 + (1 - Math.sin(t * Math.PI)) * 60;
        return <circle key={`l${i}`} cx={x} cy={y} r="3.1" fill="url(#chainGrad)" />;
      })}
      <defs>
        <linearGradient id="chainGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbeebc" />
          <stop offset="60%" stopColor="#e2b53c" />
          <stop offset="100%" stopColor="#b88a26" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="opacity-50">
      <path
        d="M12 20s-7-4.5-9.3-9C1.2 8 2.6 4.8 5.8 4.8c2 0 3.3 1.3 4.2 2.6.9-1.3 2.2-2.6 4.2-2.6 3.2 0 4.6 3.2 3.1 6.2C19 15.5 12 20 12 20Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
