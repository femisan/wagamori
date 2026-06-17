"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Show, SignInButton } from "@clerk/nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NecklacePreviewCard from "@/components/NecklacePreviewCard";
import { useI18n } from "@/components/LangProvider";
import type { Dict } from "@/lib/i18n";
import {
  DEFAULT_CUSTOMIZATION,
  METALS,
  type Customization,
  type MetalId,
  type StyleId,
  formatPrice,
  priceFor,
} from "@/lib/products";
import { downscaleDataUrl, fileToDataUrl, stylizeOnCanvas } from "@/lib/stylize";

type Step = 1 | 2 | 3 | 4;

export default function StudioPage() {
  const { t, locale } = useI18n();
  const [step, setStep] = useState<Step>(1);
  const [original, setOriginal] = useState<string | null>(null);
  const [originalSmall, setOriginalSmall] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);
  const [c, setC] = useState<Customization>(DEFAULT_CUSTOMIZATION);
  const [email, setEmail] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subjectMode, setSubjectMode] = useState<"all" | "solo">("solo");
  const [connectMode, setConnectMode] = useState<"joined" | "linked">("linked");
  const [editInput, setEditInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const price = useMemo(() => priceFor(c), [c]);

  // Restore in-progress design ONLY when returning from login (not on a fresh
  // visit), so a previous session's preview never shows up unexpectedly.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore after login reload */
    try {
      if (sessionStorage.getItem("wagamori-resume") !== "1") return;
      sessionStorage.removeItem("wagamori-resume");
      const raw = sessionStorage.getItem("wagamori-studio-v1");
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.preview) setPreview(s.preview);
      if (s.original) {
        setOriginal(s.original);
        setOriginalSmall(s.original);
        fetch(s.original)
          .then((r) => r.blob())
          .then((b) => setOriginalFile(new File([b], "restored.png", { type: b.type || "image/png" })))
          .catch(() => {});
      }
      if (s.c) setC(s.c);
      if (typeof s.step === "number") setStep(s.step);
      if (s.subjectMode) setSubjectMode(s.subjectMode);
      if (s.connectMode) setConnectMode(s.connectMode);
      if (s.genNote) setGenNote(s.genNote);
      if (s.designId) setDesignId(s.designId);
    } catch {
      /* ignore corrupt snapshot */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist the design so login (which reloads the page) doesn't lose it.
  useEffect(() => {
    if (!preview) return;
    const snap = { preview, original: originalSmall, c, step, subjectMode, connectMode, genNote, designId };
    try {
      sessionStorage.setItem("wagamori-studio-v1", JSON.stringify(snap));
    } catch {
      try {
        sessionStorage.setItem("wagamori-studio-v1", JSON.stringify({ ...snap, original: null }));
      } catch {
        /* quota — give up persisting */
      }
    }
  }, [preview, originalSmall, c, step, subjectMode, connectMode, genNote, designId]);

  // generate() accepts the image explicitly so it can run immediately after an
  // upload (before React state has flushed) — pass the fresh file + data URL.
  const generate = useCallback(
    async (
      style: StyleId,
      fileArg?: File,
      urlArg?: string,
      modeArg?: "all" | "solo",
      connArg?: "joined" | "linked",
      metalArg?: MetalId,
    ) => {
      const file = fileArg ?? originalFile;
      const url = urlArg ?? original;
      if (!file || !url) return;
      const metal = metalArg ?? c.metal;
      setC((prev) => ({ ...prev, style }));
      setGenerating(true);
      setGenNote(null);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("image", file);
        fd.append("style", style);
        fd.append("metal", metal);
        fd.append("subjects", modeArg ?? subjectMode);
        fd.append("connection", connArg ?? connectMode);
        const res = await fetch("/api/generate", { method: "POST", body: fd });
        const json = await res.json();
        if (json.ok && json.image) {
          setPreview(json.image);
        } else {
          // graceful fallback so the preview always renders
          const styled = await stylizeOnCanvas(url, style, metal);
          setPreview(styled);
          setGenNote(json.reason === "no_api_key" ? t.studio.genNote.noKey : t.studio.genNote.generic);
        }
      } catch {
        const styled = await stylizeOnCanvas(url, style, metalArg ?? c.metal);
        setPreview(styled);
        setGenNote(t.studio.genNote.generic);
      } finally {
        setGenerating(false);
      }
    },
    [originalFile, original, c.metal, subjectMode, connectMode, t],
  );

  const changeSubjectMode = useCallback(
    (m: "all" | "solo") => {
      setSubjectMode(m);
      // Re-render the preview with the new mode so the change is visible.
      if (preview && !generating) generate(c.style, undefined, undefined, m, connectMode);
    },
    [preview, generating, generate, c.style, connectMode],
  );

  const changeConnectMode = useCallback(
    (m: "joined" | "linked") => {
      setConnectMode(m);
      if (preview && !generating) generate(c.style, undefined, undefined, subjectMode, m);
    },
    [preview, generating, generate, c.style, subjectMode],
  );

  // Colour change is frontend-only: the preview card's metal frame (bezel +
  // chain + bail) recolours instantly via CSS. We do NOT re-run the AI — the
  // enamel art stays as generated, only the metal finish shown around it changes.
  const changeMetal = useCallback((m: MetalId) => {
    setC((prev) => ({ ...prev, metal: m }));
  }, []);

  const runEdit = useCallback(async () => {
    if (!preview || !editInput.trim()) return;
    setEditing(true);
    setEditErr(null);
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: preview,
          instruction: editInput,
          metal: c.metal,
          designId,
          original: designId ? undefined : originalSmall,
          style: c.style,
          subjects: subjectMode,
          connection: connectMode,
        }),
      });
      const json = await res.json();
      if (json.ok && json.image) {
        setPreview(json.image);
        if (json.designId) setDesignId(json.designId);
        setEditInput("");
      } else if (res.status === 429) {
        setEditErr(t.studio.edit.limit);
      } else {
        setEditErr(t.studio.edit.failed);
      }
    } catch {
      setEditErr(t.studio.edit.failed);
    } finally {
      setEditing(false);
    }
  }, [preview, editInput, c.metal, c.style, designId, originalSmall, subjectMode, connectMode, t]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError(t.studio.errNotImage);
        return;
      }
      const url = await fileToDataUrl(file);
      setOriginal(url);
      setOriginalFile(file);
      setPreview(null);
      setStep(2);
      // Keep a small copy for state persistence (survives login reload).
      downscaleDataUrl(url, 1024).then(setOriginalSmall).catch(() => setOriginalSmall(url));
      // Auto-generate the default style right away — no extra click needed.
      generate("enamel", file, url);
    },
    [t, generate],
  );

  const checkout = useCallback(async () => {
    setCheckingOut(true);
    setError(null);
    // Persisting artwork is best-effort — it must NEVER block reaching checkout.
    const persist = async (dataUrl: string, kind: string): Promise<string | undefined> => {
      try {
        const res = await fetch("/api/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl, kind }),
        });
        if (!res.ok) return undefined;
        const j = await res.json();
        return j.ok ? j.url : undefined;
      } catch {
        return undefined;
      }
    };

    try {
      // 1) persist artwork + original photo so the order can be fulfilled and
      //    the customer can later view/share their sample. Downscale first so
      //    large phone photos don't exceed the request-body limit.
      let artworkUrl: string | undefined;
      let originalUrl: string | undefined;
      if (preview) artworkUrl = await persist(preview, "preview");
      if (original) {
        const small = await downscaleDataUrl(original, 1200);
        originalUrl = await persist(small, "original");
      }
      // 2) create checkout session (or demo success)
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customization: c, priceCents: price, artworkUrl, originalUrl, email, locale }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        setError(json.error || t.studio.errCheckout);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.studio.errCheckout);
    } finally {
      setCheckingOut(false);
    }
  }, [c, price, preview, original, email, locale, t]);

  const metalOptions = METALS.map((m) => ({
    id: m.id,
    label: t.product.metals[m.id].label,
    sub: t.product.metals[m.id].desc,
    swatch: m.swatch,
    delta: m.priceDelta,
  }));

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:py-12">
        <Stepper
          step={step}
          labels={t.studio.steps}
          onJump={(s) => (s < step || preview ? setStep(s) : null)}
          hasArt={!!preview}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* Left: live preview */}
          <div className="order-2 lg:order-1">
            <div className="lg:sticky lg:top-24">
              <div className="relative">
                <NecklacePreviewCard
                  src={preview ?? original}
                  metal={c.metal}
                  style={c.style}
                  engraving={c.engraving}
                  loading={generating}
                />
                {preview && original && (
                  <div className="absolute -bottom-1 right-0 w-20 rotate-3 sm:w-24">
                    <div className="card overflow-hidden p-1 shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={original}
                        alt="your photo"
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
              {genNote && (
                <p className="mx-auto mt-4 max-w-sm text-center text-xs text-muted">{genNote}</p>
              )}
              {preview && (
                <p className="mt-5 text-center font-display text-2xl">
                  {formatPrice(price)}
                  <span className="ml-2 align-middle text-sm font-sans text-muted">
                    {t.studio.freeShipping}
                  </span>
                </p>
              )}

              {preview && (
                <div className="card mt-5 p-4">
                  <h3 className="font-display text-lg">{t.studio.edit.title}</h3>
                  <Show when="signed-out">
                    <p className="mt-1 text-sm text-muted">{t.studio.edit.loginNote}</p>
                    <SignInButton mode="modal" forceRedirectUrl="/studio" signUpForceRedirectUrl="/studio">
                      <button
                        onClick={() => {
                          try {
                            sessionStorage.setItem("wagamori-resume", "1");
                          } catch {}
                        }}
                        className="btn-primary mt-3 w-full cursor-pointer rounded-full px-5 py-3 text-sm font-medium"
                      >
                        {t.studio.edit.loginToEdit}
                      </button>
                    </SignInButton>
                  </Show>
                  <Show when="signed-in">
                    {/* connection (multiple figures) */}
                    {subjectMode === "all" && (
                      <div className="mt-2">
                        <span className="text-xs text-muted">{t.studio.connection.label}</span>
                        <div className="mt-1 flex gap-2">
                          {(["linked", "joined"] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => changeConnectMode(m)}
                              disabled={generating}
                              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
                                connectMode === m ? "border-rose bg-rose/10" : "border-line hover:border-gold-soft"
                              }`}
                            >
                              {t.studio.connection[m]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* chat fine-tune */}
                    <div className="mt-3 flex gap-2">
                      <input
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !editing && editInput.trim()) runEdit();
                        }}
                        placeholder={t.studio.edit.placeholder}
                        disabled={editing}
                        className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-gold"
                      />
                      <button
                        onClick={runEdit}
                        disabled={editing || !editInput.trim()}
                        className="btn-primary shrink-0 cursor-pointer rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                      >
                        {editing ? t.studio.edit.editing : t.studio.edit.send}
                      </button>
                    </div>
                    {editErr && <p className="mt-2 text-xs text-blush-deep">{editErr}</p>}
                  </Show>
                </div>
              )}
            </div>
          </div>

          {/* Right: controls */}
          <div className="order-1 lg:order-2">
            {error && (
              <div className="mb-4 rounded-xl border border-blush-deep/40 bg-blush/20 px-4 py-3 text-sm text-foreground">
                {error}
              </div>
            )}

            {step === 1 && <Uploader t={t} onPick={() => fileInput.current?.click()} onDrop={handleFile} />}

            {step === 2 && (
              <section>
                <h2 className="font-display text-2xl">{t.studio.preview.title}</h2>
                <p className="mt-1 text-sm text-muted">{t.studio.preview.sub}</p>

                <div className="mt-4">
                  <Label>{t.studio.subjects.label}</Label>
                  <div className="mt-2 inline-flex rounded-full border border-line bg-surface p-0.5 text-sm">
                    {(["solo", "all"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => changeSubjectMode(m)}
                        disabled={generating}
                        className={`cursor-pointer rounded-full px-4 py-1.5 transition-colors disabled:opacity-50 ${
                          subjectMode === m
                            ? "bg-rose/15 font-medium text-foreground"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        {t.studio.subjects[m]}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => generate(c.style)}
                  disabled={generating || !originalFile}
                  className="btn-ghost mt-5 w-full cursor-pointer rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50"
                >
                  {generating ? t.studio.style.creating : t.studio.preview.regenerate}
                </button>

                <div className="mt-6 flex gap-3">
                  <button onClick={() => setStep(1)} className="btn-ghost cursor-pointer rounded-full px-5 py-3 text-sm">
                    {t.studio.style.changePhoto}
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!preview || generating}
                    className="btn-primary cursor-pointer rounded-full px-6 py-3 text-sm font-medium disabled:opacity-40"
                  >
                    {generating ? t.studio.style.creating : t.studio.style.looksGreat}
                  </button>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-6">
                <h2 className="font-display text-2xl">{t.studio.customize.title}</h2>

                <Choice
                  label={t.studio.customize.metal}
                  options={metalOptions}
                  value={c.metal}
                  onChange={(id) => changeMetal(id as MetalId)}
                />

                <div>
                  <Label>{t.studio.customize.engraving}</Label>
                  <input
                    value={c.engraving}
                    maxLength={24}
                    onChange={(e) => setC({ ...c, engraving: e.target.value })}
                    placeholder={t.studio.customize.engravingPlaceholder}
                    className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-gold"
                  />
                  <p className="mt-1 text-xs text-muted">
                    {c.engraving.length}
                    {t.studio.customize.charsSuffix} ・ {t.studio.customize.engravingNote}
                  </p>
                </div>

                <p className="text-xs text-muted">{t.studio.customize.fixedSpec}</p>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="btn-ghost cursor-pointer rounded-full px-5 py-3 text-sm">
                    {t.studio.customize.backStyle}
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    className="btn-primary cursor-pointer rounded-full px-6 py-3 text-sm font-medium"
                  >
                    {t.studio.customize.continue}
                  </button>
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-5">
                <h2 className="font-display text-2xl">{t.studio.checkout.title}</h2>
                <OrderSummary c={c} price={price} t={t} />

                <div>
                  <Label>{t.studio.checkout.email}</Label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.studio.checkout.emailPlaceholder}
                    className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <Label>{t.studio.checkout.notes}</Label>
                  <textarea
                    value={c.notes}
                    onChange={(e) => setC({ ...c, notes: e.target.value })}
                    rows={3}
                    placeholder={t.studio.checkout.notesPlaceholder}
                    className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-gold"
                  />
                  <p className="mt-1 text-xs text-muted">{t.studio.checkout.notesHint}</p>
                </div>

                <button
                  onClick={checkout}
                  disabled={checkingOut}
                  className="btn-primary w-full cursor-pointer rounded-full px-6 py-4 text-base font-medium disabled:opacity-50"
                >
                  {checkingOut
                    ? t.studio.checkout.paying
                    : `${t.studio.checkout.payPrefix} ${formatPrice(price)} ${t.studio.checkout.paySuffix}`}
                </button>
                <p className="text-center text-xs text-muted">{t.studio.checkout.secureNote}</p>
                <button onClick={() => setStep(3)} className="mx-auto block cursor-pointer text-sm text-muted hover:text-foreground">
                  {t.studio.checkout.backCustomize}
                </button>
              </section>
            )}
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </main>
      <Footer />
    </>
  );
}

/* ---------- small UI pieces ---------- */

function Stepper({
  step,
  labels,
  onJump,
  hasArt,
}: {
  step: Step;
  labels: readonly string[];
  onJump: (s: Step) => void;
  hasArt: boolean;
}) {
  return (
    <ol className="flex items-center justify-center gap-2 text-xs sm:gap-4 sm:text-sm">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              onClick={() => onJump(n)}
              disabled={n > step && !hasArt}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition ${
                active ? "bg-rose/15 text-foreground" : done ? "text-foreground/70" : "text-muted"
              } ${n <= step || hasArt ? "cursor-pointer" : ""}`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                  active || done ? "btn-primary" : "border border-line"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < labels.length - 1 && <span className="h-px w-4 bg-line sm:w-8" />}
          </li>
        );
      })}
    </ol>
  );
}

function Uploader({ t, onPick, onDrop }: { t: Dict; onPick: () => void; onDrop: (f: File) => void }) {
  const [over, setOver] = useState(false);
  return (
    <section>
      <h2 className="font-display text-2xl">{t.studio.upload.title}</h2>
      <p className="mt-1 text-sm text-muted">{t.studio.upload.sub}</p>
      <div
        onClick={onPick}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onDrop(f);
        }}
        className={`mt-5 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
          over ? "border-rose bg-rose/5" : "border-line hover:border-gold-soft hover:bg-surface"
        }`}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full bg-rose/10">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="1.6">
            <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
          </svg>
        </div>
        <p className="mt-4 font-medium">{t.studio.upload.dropTitle}</p>
        <p className="mt-1 text-xs text-muted">{t.studio.upload.dropHint}</p>
      </div>
      <ul className="mt-6 space-y-2 text-sm text-muted">
        {t.studio.upload.bullets.map((b) => (
          <li key={b}>✓ {b}</li>
        ))}
      </ul>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-foreground/80">{children}</span>;
}

function Choice({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: { id: string; label: string; sub?: string; swatch?: string; delta: number }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            disabled={disabled}
            className={`card cursor-pointer px-3 py-3 text-left transition hover:border-gold-soft disabled:cursor-not-allowed disabled:opacity-60 ${
              value === o.id ? "ring-2 ring-rose/60" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              {o.swatch && (
                <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: o.swatch }} />
              )}
              <span className="text-sm font-medium">{o.label}</span>
            </div>
            {o.sub && <p className="mt-1 text-xs text-muted">{o.sub}</p>}
            {o.delta !== 0 && (
              <p className="mt-1 text-xs text-muted">
                {o.delta > 0 ? `+${formatPrice(o.delta)}` : `−${formatPrice(-o.delta)}`}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function OrderSummary({ c, price, t }: { c: Customization; price: number; t: Dict }) {
  const rows = [
    [t.studio.summary.item, t.studio.summary.itemValue],
    [t.studio.summary.metal, t.product.metals[c.metal].label],
    [t.studio.summary.chain, c.length],
    c.engraving ? [t.studio.summary.engraving, `“${c.engraving}”`] : null,
  ].filter(Boolean) as [string, string][];
  return (
    <div className="card divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted">{k}</span>
          <span className="font-medium">{v}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-muted">{t.studio.summary.totalShipping}</span>
        <span className="font-display text-xl">{formatPrice(price)}</span>
      </div>
    </div>
  );
}
