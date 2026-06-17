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

// Light → mid → dark stops per finish. Used for the bezel, the chain, and the
// bail so changing the colour recolours the whole metal frame instantly (no AI).
const METAL_STOPS: Record<MetalId, [string, string, string]> = {
  gold: ["#fbeebc", "#e2b53c", "#b88a26"],
  silver: ["#eef1f3", "#aab0b4", "#7c8388"],
  rosegold: ["#f3d3c8", "#d89a89", "#b06f5e"],
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
  const stops = METAL_STOPS[metal];
  const bezel = `linear-gradient(135deg,${stops[0]},${stops[1]} 52%,${stops[2]})`;
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
          <Chain stops={stops} metal={metal} />

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
                style={{ borderColor: stops[1] }}
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
          <p className="mx-auto mt-1 max-w-[260px] text-[11px] uppercase tracking-[0.1em] text-muted">
            {metalLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

function Chain({ stops, metal }: { stops: [string, string, string]; metal: MetalId }) {
  // A small V of beads forming the chain down to the pendant bail.
  const beads = 9;
  const gradId = `chainGrad-${metal}`;
  return (
    <svg width="240" height="74" viewBox="0 0 240 74" className="overflow-visible">
      {Array.from({ length: beads }).map((_, i) => {
        const t = i / (beads - 1);
        const x = 6 + t * (240 - 12);
        // parabola dipping to center
        const y = 6 + Math.pow((t - 0.5) * 2, 2) * 0 + (1 - Math.sin(t * Math.PI)) * 60;
        return <circle key={`l${i}`} cx={x} cy={y} r="3.1" fill={`url(#${gradId})`} />;
      })}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={stops[0]} />
          <stop offset="60%" stopColor={stops[1]} />
          <stop offset="100%" stopColor={stops[2]} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="opacity-50">
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
