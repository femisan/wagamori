"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { composeShareImage } from "@/lib/share";
import { SITE } from "@/lib/site";
import { useI18n } from "./LangProvider";

interface Props {
  preview: string;
  original?: string;
  engraving?: string;
  /** Add a QR + URL + CTA band that drives viewers back to the site to order. */
  withQr?: boolean;
}

/** Renders a single shareable image (necklace preview + the user's photo) with
 *  save + share controls. With `withQr`, adds a scannable QR + site link. */
export default function ShareCard({ preview, original, engraving, withQr = false }: Props) {
  const { t } = useI18n();
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let qr: string | undefined;
      if (withQr) {
        try {
          qr = await QRCode.toDataURL(`${SITE.url}/?utm_source=share`, {
            margin: 1,
            width: 360,
            color: { dark: "#4a2530", light: "#ffffff" },
          });
        } catch {
          /* QR optional */
        }
      }
      const url = await composeShareImage({
        preview,
        original,
        engraving,
        logo: "/brand/wagamori-logo.png",
        tagline: t.share.tagline,
        yourPhotoLabel: t.share.yourPhoto,
        qr,
        url: withQr ? SITE.url.replace(/^https?:\/\//, "") : undefined,
        cta: t.share.cta,
        scanHint: t.share.scanHint,
      });
      if (alive) setImg(url);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [preview, original, engraving, withQr, t]);

  const download = () => {
    if (!img) return;
    const a = document.createElement("a");
    a.href = img;
    a.download = "wagamori-preview.png";
    a.click();
  };

  const share = async () => {
    if (!img) return;
    try {
      setBusy(true);
      const blob = await (await fetch(img)).blob();
      const file = new File([blob], "wagamori-preview.png", { type: "image/png" });
      const navAny = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean;
      };
      if (navAny.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Wagamori", text: t.share.tagline });
      } else {
        download();
      }
    } catch {
      // user cancelled or unsupported → no-op
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card overflow-hidden p-4">
      <h3 className="font-display text-xl">{t.share.title}</h3>
      <p className="mt-1 text-sm text-muted">{t.share.intro}</p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-blush/10">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="Wagamori sample preview" className="block w-full" />
        ) : (
          <div className="skeleton aspect-square w-full" />
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={download}
          disabled={!img}
          className="btn-primary flex-1 cursor-pointer rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50"
        >
          {t.share.save}
        </button>
        <button
          onClick={share}
          disabled={!img || busy}
          className="btn-ghost flex-1 cursor-pointer rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50"
        >
          {t.share.share}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">{img ? "" : t.share.building}</p>
    </div>
  );
}
