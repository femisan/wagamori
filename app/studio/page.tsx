"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Show, SignInButton } from "@clerk/nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NecklacePreviewCard from "@/components/NecklacePreviewCard";
import ShareCard from "@/components/ShareCard";
import { useI18n } from "@/components/LangProvider";
import { variantLabel, type Dict } from "@/lib/i18n";
import {
  DEFAULT_CUSTOMIZATION,
  MATERIALS,
  MATERIAL_PRICES,
  METALS,
  allowedForms,
  allowedMetals,
  type Customization,
  type MaterialId,
  type MetalId,
  type FormId,
  type DesignMode,
  formatPrice,
  priceFor,
} from "@/lib/products";
import { downscaleDataUrl, fileToDataUrl, stylizeOnCanvas } from "@/lib/stylize";

type Step = 1 | 2 | 3 | 4;

/** One AI attempt. `id` is null for local-only fallbacks (no DB / canvas preview). */
type Version = {
  id: string | null;
  round: number;
  imageUrl: string;
  wish: string | null;
  metal: MetalId;
  baseRound?: number | null; // refined from this version (null = from the original)
};

/** Which image the next attempt starts from. */
type Base = "selected" | "original";

type CartItem = {
  key: string;
  customization: Customization;
  price: number;
  preview: string;
  original: string;
  designId: string | null;
  versionId: string | null;
  designMode: DesignMode;
  designBrief: string;
};

/** Set the metal colour, keeping the material if it offers that colour (else silver offers all). */
function withColour(prev: Customization, metal: MetalId): Customization {
  const material: MaterialId = allowedMetals(prev.material).includes(metal) ? prev.material : "silver";
  const forms = allowedForms(material);
  return { ...prev, material, metal, form: material === prev.material && forms.includes(prev.form) ? prev.form : forms[0] };
}

// Uploads above this go through a downscale so they fit the 4.5 MB function body limit.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export default function StudioPage() {
  const { t, locale } = useI18n();
  const [step, setStep] = useState<Step>(1);
  const [original, setOriginal] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<Blob | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [c, setC] = useState<Customization>(DEFAULT_CUSTOMIZATION);
  const [email, setEmail] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subjectMode, setSubjectMode] = useState<"all" | "solo">("solo");
  const [connectMode, setConnectMode] = useState<"joined" | "linked">("linked");
  const [wish, setWish] = useState("");
  const [base, setBase] = useState<Base>("selected");
  const [designMode, setDesignMode] = useState<DesignMode>("ai");
  const [brief, setBrief] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const current = versions[selectedIdx] ?? null;
  const preview = current?.imageUrl ?? null;
  const price = useMemo(() => priceFor(c, designMode), [c, designMode]);
  // "Edit selected" needs a saved AI version to refine; otherwise start from the original.
  const canRefine = !!current?.id;
  const effectiveBase: Base = base === "selected" && canRefine ? "selected" : "original";
  // An AI version is only orderable in the material it was generated in (designers can use any).
  const metalMismatch = designMode === "ai" && !!current && current.metal !== c.metal;
  // Something orderable is on the canvas: an AI version, or a designer request on the original.
  const hasItem = !!preview || (designMode === "human" && !!original);
  const cartTotal = useMemo(() => cart.reduce((s, it) => s + it.price, 0), [cart]);
  const material = c.material;

  // Load a saved design (original + every attempt) — used after login and from
  // "continue this design" links (/studio?design=<id>).
  const loadDesign = useCallback(async (id: string, preferVersionId?: string | null) => {
    const res = await fetch(`/api/design?id=${encodeURIComponent(id)}`);
    if (!res.ok) return false;
    const j = await res.json();
    if (!j.ok) return false;
    type Row = { id: string; round: number; imageUrl: string; instruction: string | null; metal: string | null; source: string; baseVersionId: string | null };
    const rows = (j.versions as Row[]).filter((v) => v.source !== "cs");
    const roundOf = new Map(rows.map((v) => [v.id, v.round]));
    const vs: Version[] = rows.map((v) => ({
      id: v.id,
      round: v.round,
      imageUrl: v.imageUrl,
      wish: v.instruction,
      metal: (v.metal as MetalId) || "gold",
      baseRound: v.baseVersionId ? roundOf.get(v.baseVersionId) ?? null : null,
    }));
    setDesignId(j.design.id);
    setOriginal(j.design.originalUrl);
    setOriginalFile(null);
    setVersions(vs);
    const want = preferVersionId || j.design.selectedVersionId;
    const idx = Math.max(0, vs.findIndex((v) => v.id === want));
    setSelectedIdx(vs.length ? (want ? idx : vs.length - 1) : 0);
    const metal = (vs[idx]?.metal ?? j.design.metal ?? "gold") as MetalId;
    setC((prev) => withColour(prev, metal));
    if (vs.length) setStep(2);
    return true;
  }, []);

  // Restore: ?design=<id> link, or the snapshot saved before a login round-trip.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore on mount */
    const fromUrl = new URLSearchParams(window.location.search).get("design");
    if (fromUrl) {
      loadDesign(fromUrl);
      return;
    }
    try {
      if (sessionStorage.getItem("wagamori-resume") !== "1") return;
      sessionStorage.removeItem("wagamori-resume");
      const raw = sessionStorage.getItem("wagamori-studio-v2");
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.c) setC(s.c);
      if (s.subjectMode) setSubjectMode(s.subjectMode);
      if (s.connectMode) setConnectMode(s.connectMode);
      if (Array.isArray(s.cart)) setCart(s.cart);
      if (s.designMode === "human") setDesignMode("human");
      if (typeof s.brief === "string") setBrief(s.brief);
      if (s.designId) {
        loadDesign(s.designId, s.versionId);
      } else if (s.original) {
        // No DB history (demo/local) — fall back to the snapshot itself.
        setOriginal(s.original);
        if (Array.isArray(s.versions)) setVersions(s.versions);
        if (typeof s.selectedIdx === "number") setSelectedIdx(s.selectedIdx);
        if (typeof s.step === "number") setStep(s.step);
        fetch(s.original)
          .then((r) => r.blob())
          .then(setOriginalFile)
          .catch(() => {});
      }
    } catch {
      /* ignore corrupt snapshot */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadDesign]);

  // Snapshot before login (the Clerk modal reloads the page).
  const snapshotForLogin = useCallback(async () => {
    try {
      const small = !designId && original ? await downscaleDataUrl(original, 1024) : null;
      const snap = {
        c,
        subjectMode,
        connectMode,
        designId,
        versionId: current?.id ?? null,
        step,
        selectedIdx,
        designMode,
        brief,
        cart: cart.filter((it) => !it.preview.startsWith("data:")),
        ...(designId ? {} : { original: small, versions: versions.filter((v) => !v.imageUrl.startsWith("data:")) }),
      };
      sessionStorage.setItem("wagamori-studio-v2", JSON.stringify(snap));
      sessionStorage.setItem("wagamori-resume", "1");
    } catch {
      /* quota — the design is still saved server-side when designId exists */
    }
  }, [c, subjectMode, connectMode, designId, current, step, selectedIdx, designMode, brief, cart, original, versions]);

  /**
   * Generate ONE attempt. `file` is passed right after an upload (first preview).
   * Retries use the chosen reference: the original photo, or the selected version
   * (refined with the wish — this is how "go back to version 2 and…" works).
   */
  const generate = useCallback(
    async (opts: { file?: Blob; url?: string; metal?: MetalId; withWish?: boolean } = {}) => {
      const metal = opts.metal ?? c.metal;
      const file = opts.file ?? originalFile;
      const url = opts.url ?? original;
      const isFirst = !!opts.file;
      if (!isFirst && !designId && !file) return;
      const refine = !isFirst && effectiveBase === "selected" && !!current?.id;
      if (refine && !wish.trim()) {
        setGenErr(t.studio.preview.wishRequired);
        return;
      }
      setGenerating(true);
      setGenNote(null);
      setGenErr(null);
      setError(null);
      try {
        const fd = new FormData();
        if (!isFirst && designId) fd.append("designId", designId);
        else if (file) fd.append("image", file);
        fd.append("metal", metal);
        fd.append("subjects", subjectMode);
        fd.append("connection", connectMode);
        if (opts.withWish && wish.trim()) fd.append("wish", wish.trim());
        if (refine && current?.id) fd.append("base", current.id);
        fd.append("optIn", optIn ? "1" : "0");
        const res = await fetch("/api/generate", { method: "POST", body: fd });
        const json = await res.json();
        if (json.ok && json.image) {
          const v: Version = {
            id: json.versionId ?? null,
            round: json.round ?? versions.length,
            imageUrl: json.image,
            wish: json.wish ?? null,
            metal,
            baseRound: refine ? current?.round ?? null : null,
          };
          if (json.designId) setDesignId(json.designId);
          setVersions((prev) => {
            const next = isFirst ? [v] : [...prev, v];
            setSelectedIdx(next.length - 1);
            return next;
          });
          setWish("");
          setNeedLogin(false);
        } else if (res.status === 401 && json.error === "login_required") {
          setNeedLogin(true);
        } else if (res.status === 429) {
          setGenErr(json.error === "rate_limited" && !json.signedIn ? t.studio.preview.rateLimited : t.studio.preview.limit);
        } else if (json.reason === "no_api_key" && url && isFirst) {
          // Demo / local setup without an OpenAI key: show a canvas approximation.
          // Real failures never do this — a fake preview would mislead the customer.
          const styled = await stylizeOnCanvas(url, "enamel", metal);
          setVersions([{ id: null, round: 0, imageUrl: styled, wish: null, metal }]);
          setSelectedIdx(0);
          setGenNote(t.studio.genNote.noKey);
        } else {
          setGenErr(t.studio.preview.failed);
        }
      } catch {
        setGenErr(t.studio.preview.failed);
      } finally {
        setGenerating(false);
      }
    },
    [c.metal, originalFile, original, designId, effectiveBase, current, subjectMode, connectMode, wish, optIn, versions.length, t],
  );

  // Colour change: keep the material if it offers that colour, else move to silver.
  const pickMetal = useCallback((m: MetalId) => {
    setC((prev) => withColour(prev, m));
  }, []);

  // Material change: keep the colour if the new material offers it; reset the
  // form to the material's primary one (silver → necklace, alloy → keychain).
  const pickMaterial = useCallback((mat: MaterialId) => {
    setC((prev) => {
      if (prev.material === mat) return prev;
      const metals = allowedMetals(mat);
      return {
        ...prev,
        material: mat,
        metal: metals.includes(prev.metal) ? prev.metal : metals[0],
        form: allowedForms(mat)[0],
      };
    });
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError(t.studio.errNotImage);
        return;
      }
      const url = await fileToDataUrl(file);
      // Keep the original as-is; only shrink files too big for the upload limit.
      let upload: Blob = file;
      if (file.size > MAX_UPLOAD_BYTES) {
        const small = await downscaleDataUrl(url, 2560, 0.92);
        upload = await (await fetch(small)).blob();
      }
      setOriginal(url);
      setOriginalFile(upload);
      setDesignId(null);
      setVersions([]);
      setSelectedIdx(0);
      setNeedLogin(false);
      setShowShare(false);
      setStep(2);
      generate({ file: upload, url });
    },
    [t, generate],
  );

  const persist = useCallback(async (dataUrl: string, kind: string): Promise<string | undefined> => {
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
  }, []);

  const currentItem = useCallback((): CartItem | null => {
    const image = preview ?? (designMode === "human" ? original : null);
    if (!image || !original) return null;
    return {
      key: `${designId ?? "local"}-${current?.id ?? selectedIdx}-${Date.now()}`,
      customization: { ...c },
      price,
      preview: image,
      original,
      designId,
      // For designer orders this is just the AI reference the customer liked (if any).
      versionId: current?.id ?? null,
      designMode,
      designBrief: designMode === "human" ? brief.trim() : "",
    };
  }, [preview, original, designId, current, selectedIdx, c, price, designMode, brief]);

  const resetStudio = useCallback(() => {
    setStep(1);
    setOriginal(null);
    setOriginalFile(null);
    setDesignId(null);
    setVersions([]);
    setSelectedIdx(0);
    setGenNote(null);
    setGenErr(null);
    setNeedLogin(false);
    setWish("");
    setBase("selected");
    setDesignMode("ai");
    setBrief("");
    setShowShare(false);
    setC((prev) => ({ ...DEFAULT_CUSTOMIZATION, material: prev.material, metal: prev.metal, form: allowedForms(prev.material)[0] }));
  }, []);

  const addToCart = useCallback(() => {
    const it = currentItem();
    if (!it) return;
    setCart((prev) => [...prev, it]);
    resetStudio();
  }, [currentItem, resetStudio]);

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) => prev.filter((it) => it.key !== key));
  }, []);

  const checkout = useCallback(async () => {
    setCheckingOut(true);
    setError(null);
    const cur = currentItem();
    const allItems = [...cart, ...(cur ? [cur] : [])];
    if (allItems.length === 0) {
      setError(t.studio.checkout.emptyCart);
      setCheckingOut(false);
      return;
    }
    try {
      // Saved designs are resolved server-side from designId/versionId; only
      // local-only previews (no DB) need their images uploaded here.
      const items = await Promise.all(
        allItems.map(async (it) => {
          const needsUpload = !it.designId || !it.versionId;
          const [artworkUrl, originalUrl] = needsUpload
            ? await Promise.all([
                it.preview.startsWith("http") ? it.preview : persist(it.preview, "preview"),
                it.original.startsWith("http")
                  ? it.original
                  : downscaleDataUrl(it.original, 1200).then((small) => persist(small, "original")),
              ])
            : [undefined, undefined];
          return {
            customization: it.customization,
            designId: it.designId,
            versionId: it.versionId,
            designMode: it.designMode,
            designBrief: it.designBrief,
            artworkUrl,
            originalUrl,
          };
        }),
      );
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, email, locale }),
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
  }, [cart, currentItem, email, locale, persist, t]);

  const formOptions = allowedForms(c.material).map((id) => ({
    id,
    label: t.product.forms[id].label,
    sub: t.product.forms[id].desc,
    delta: 0,
  }));

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:py-12">
        <Stepper
          step={step}
          labels={t.studio.steps}
          onJump={(s) => {
            const ready = !!preview || (designMode === "human" && !!original);
            if (s < step || (ready && !(s > 2 && metalMismatch))) setStep(s);
          }}
          hasArt={!!preview}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* Left: live preview */}
          <div className="order-2 lg:order-1">
            <div className="lg:sticky lg:top-24">
              <div className="relative">
                <NecklacePreviewCard
                  src={preview ?? original}
                  material={c.material}
                  metal={c.metal}
                  form={c.form}
                  engraving={c.engraving}
                  loading={generating && !preview}
                />
                {preview && original && (
                  <div className="absolute -bottom-1 right-0 w-20 rotate-3 sm:w-24">
                    <div className="card overflow-hidden p-1 shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={original} alt={t.studio.preview.original} className="aspect-square w-full rounded-lg object-cover" />
                    </div>
                  </div>
                )}
              </div>
              {genNote && <p className="mx-auto mt-4 max-w-sm text-center text-xs text-muted">{genNote}</p>}
              {preview && (
                <p className="mt-5 text-center font-display text-2xl">
                  {formatPrice(price)}
                  <span className="ml-2 align-middle font-sans text-sm text-muted">{t.studio.freeShipping}</span>
                </p>
              )}

              {/* Version strip: original pinned first, then every attempt */}
              {original && (versions.length > 0 || generating) && (
                <VersionStrip
                  t={t}
                  original={original}
                  versions={versions}
                  selectedIdx={selectedIdx}
                  onSelect={(i) => {
                    setSelectedIdx(i);
                    // The artwork's metal walls define the material → keep price/form in sync.
                    if (versions[i]) pickMetal(versions[i].metal);
                  }}
                  generating={generating}
                />
              )}

              {/* Shareable image (with QR back to the site) */}
              {preview && (
                <div className="mt-4">
                  {!showShare ? (
                    <button
                      onClick={() => setShowShare(true)}
                      className="btn-ghost w-full cursor-pointer rounded-full px-5 py-3 text-sm font-medium"
                    >
                      {t.share.makeButton}
                    </button>
                  ) : (
                    <ShareCard preview={preview} original={original ?? undefined} engraving={c.engraving} withQr />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: controls */}
          <div className="order-1 lg:order-2">
            {error && (
              <div role="alert" className="mb-4 rounded-xl border border-blush-deep/40 bg-blush/20 px-4 py-3 text-sm text-foreground">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-8">
                <MaterialPicker t={t} c={c} onMaterial={pickMaterial} onColour={pickMetal} />
                <Uploader t={t} onPick={() => fileInput.current?.click()} onDrop={handleFile} />
              </div>
            )}

            {step === 2 && (
              <section>
                <h2 className="font-display text-2xl">{t.studio.preview.title}</h2>
                <p className="mt-1 text-sm text-muted">{t.studio.preview.sub}</p>

                {designMode === "ai" ? (
                  <div className="card mt-5 space-y-4 p-4">
                    <h3 className="font-display text-lg">{t.studio.preview.retryTitle}</h3>

                    <Show when="signed-in">
                      {/* Which image this attempt starts from */}
                      <div>
                        <Label>{t.studio.preview.baseLabel}</Label>
                        <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.studio.preview.baseLabel}>
                          <BaseOption
                            selected={effectiveBase === "selected"}
                            disabled={!canRefine || generating}
                            onClick={() => setBase("selected")}
                            img={canRefine ? preview : null}
                            label={t.studio.preview.baseSelected.replace("{n}", String(selectedIdx + 1))}
                          />
                          <BaseOption
                            selected={effectiveBase === "original"}
                            disabled={generating}
                            onClick={() => setBase("original")}
                            img={original}
                            label={t.studio.preview.baseOriginal}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-muted">
                          {effectiveBase === "selected" ? t.studio.preview.baseSelectedHint : t.studio.preview.baseOriginalHint}
                        </p>
                      </div>
                    </Show>

                    {effectiveBase === "original" && (
                      <>
                        <div>
                          <Label>{t.studio.subjects.label}</Label>
                          <Segmented
                            value={subjectMode}
                            options={(["solo", "all"] as const).map((m) => ({ id: m, label: t.studio.subjects[m] }))}
                            onChange={(m) => setSubjectMode(m as "solo" | "all")}
                            disabled={generating}
                          />
                        </div>
                        {subjectMode === "all" && (
                          <div>
                            <Label>{t.studio.connection.label}</Label>
                            <Segmented
                              value={connectMode}
                              options={(["linked", "joined"] as const).map((m) => ({ id: m, label: t.studio.connection[m] }))}
                              onChange={(m) => setConnectMode(m as "linked" | "joined")}
                              disabled={generating}
                            />
                          </div>
                        )}
                      </>
                    )}

                    <div>
                      <Label>{t.studio.customize.metal}</Label>
                      <VariantPicker t={t} c={c} onMaterial={pickMaterial} onColour={pickMetal} disabled={generating} />
                      {metalMismatch && <p className="mt-1.5 text-xs text-muted">{t.studio.preview.materialChangeNote}</p>}
                    </div>

                    <Show when="signed-in">
                      <div>
                        <label htmlFor="wish" className="text-sm font-medium text-foreground/80">
                          {t.studio.preview.wishLabel}
                        </label>
                        <input
                          id="wish"
                          value={wish}
                          maxLength={200}
                          onChange={(e) => {
                            setWish(e.target.value);
                            if (genErr) setGenErr(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !generating) generate({ withWish: true });
                          }}
                          placeholder={t.studio.preview.wishPlaceholder}
                          disabled={generating}
                          className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-gold"
                        />
                      </div>
                      <button
                        onClick={() => generate({ withWish: true })}
                        disabled={
                          generating || (!designId && !originalFile) || (effectiveBase === "selected" && !wish.trim())
                        }
                        className="btn-primary w-full cursor-pointer rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50"
                      >
                        {generating
                          ? t.studio.preview.retrying
                          : effectiveBase === "selected"
                            ? t.studio.preview.fixSelected
                            : t.studio.preview.regenerate}
                      </button>
                      <label className="flex cursor-pointer items-start gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={optIn}
                          onChange={(e) => setOptIn(e.target.checked)}
                          className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--rose)]"
                        />
                        <span>{t.studio.preview.optIn}</span>
                      </label>
                    </Show>

                    <Show when="signed-out">
                      {(needLogin || versions.length > 0) && (
                        <>
                          <p className="text-sm text-muted">{t.studio.preview.guestNote}</p>
                          <SignInButton mode="modal" forceRedirectUrl="/studio" signUpForceRedirectUrl="/studio">
                            <button
                              onClick={() => {
                                void snapshotForLogin();
                              }}
                              className="btn-primary w-full cursor-pointer rounded-full px-5 py-3 text-sm font-medium"
                            >
                              {t.studio.preview.loginToRetry}
                            </button>
                          </SignInButton>
                        </>
                      )}
                    </Show>

                    {genErr && (
                      <p role="alert" className="text-xs text-blush-deep">
                        {genErr}
                      </p>
                    )}
                    {/* The very first preview failed: let anyone retry it (it doesn't count as used). */}
                    {versions.length === 0 && !generating && !needLogin && originalFile && original && (
                      <button
                        onClick={() => generate({ file: originalFile, url: original })}
                        className="btn-ghost w-full cursor-pointer rounded-full px-5 py-3 text-sm font-medium"
                      >
                        {t.studio.preview.retryFirst}
                      </button>
                    )}
                  </div>
                ) : (
                  /* Designer handoff: stop the AI, write a brief, order → designer after payment */
                  <div className="card mt-5 space-y-4 border-gold-soft p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg">{t.studio.human.title}</h3>
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                        {t.studio.human.badge}
                      </span>
                    </div>
                    <p className="text-sm text-muted">{t.studio.human.desc}</p>
                    <div>
                      <label htmlFor="brief" className="text-sm font-medium text-foreground/80">
                        {t.studio.human.briefLabel}
                      </label>
                      <textarea
                        id="brief"
                        value={brief}
                        maxLength={1000}
                        rows={4}
                        onChange={(e) => setBrief(e.target.value)}
                        placeholder={t.studio.human.briefPlaceholder}
                        className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-gold"
                      />
                      <p className="mt-1 text-xs text-muted">{t.studio.human.refNote}</p>
                    </div>
                    <button
                      onClick={() => setStep(3)}
                      className="btn-primary w-full cursor-pointer rounded-full px-5 py-3 text-sm font-medium"
                    >
                      {t.studio.human.continue}
                    </button>
                    <button
                      onClick={() => setDesignMode("ai")}
                      className="mx-auto block cursor-pointer text-sm text-muted hover:text-foreground"
                    >
                      {t.studio.human.back}
                    </button>
                  </div>
                )}

                {designMode === "ai" && original && !generating && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setDesignMode("human")}
                      className="btn-ghost w-full cursor-pointer rounded-full px-5 py-3 text-sm font-medium"
                    >
                      {t.studio.human.button}
                    </button>
                    <p className="mt-1.5 text-xs text-muted">{t.studio.human.hint}</p>
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button onClick={resetStudio} className="btn-ghost cursor-pointer rounded-full px-5 py-3 text-sm">
                    {t.studio.style.changePhoto}
                  </button>
                  {designMode === "ai" && (
                    <button
                      onClick={() => setStep(3)}
                      disabled={!preview || generating || metalMismatch}
                      className="btn-primary cursor-pointer rounded-full px-6 py-3 text-sm font-medium disabled:opacity-40"
                    >
                      {generating ? t.studio.style.creating : t.studio.style.looksGreat}
                    </button>
                  )}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-6">
                <h2 className="font-display text-2xl">{t.studio.customize.title}</h2>

                {designMode === "human" ? (
                  // Designer-made: any material is fine (nothing is locked to an AI version).
                  <div>
                    <Label>{t.studio.customize.metal}</Label>
                    <VariantPicker t={t} c={c} onMaterial={pickMaterial} onColour={pickMetal} />
                  </div>
                ) : (
                  // AI version: its metal colour is fixed; the material can be any that offers it.
                  <div>
                    <Label>{t.studio.customize.metal}</Label>
                    <VariantPicker t={t} c={c} onMaterial={pickMaterial} onColour={pickMetal} lockColour />
                  </div>
                )}

                <div>
                  <Choice
                    label={t.studio.customize.form}
                    options={formOptions}
                    value={c.form}
                    onChange={(id) => setC({ ...c, form: id as FormId })}
                  />
                  {material === "alloy" && (
                    <p className="mt-2 text-xs text-muted">{t.studio.customize.formAlloyNote}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="engraving" className="text-sm font-medium text-foreground/80">
                    {t.studio.customize.engraving}
                  </label>
                  <input
                    id="engraving"
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

                <p className="text-xs text-muted">
                  {c.form === "necklace" ? t.studio.customize.fixedSpec : t.studio.customize.handNote}
                </p>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="btn-ghost cursor-pointer rounded-full px-5 py-3 text-sm">
                    {t.studio.customize.backStyle}
                  </button>
                  <button onClick={() => setStep(4)} className="btn-primary cursor-pointer rounded-full px-6 py-3 text-sm font-medium">
                    {t.studio.customize.continue}
                  </button>
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-5">
                <h2 className="font-display text-2xl">{t.studio.checkout.title}</h2>
                {hasItem && <OrderSummary c={c} price={price} t={t} designMode={designMode} />}

                {cart.length > 0 && (
                  <div className="card divide-y divide-line">
                    <p className="px-4 py-2 text-xs font-medium text-muted">
                      {t.studio.cart.title} ({cart.length + (hasItem ? 1 : 0)}
                      {t.studio.cart.items} · {t.studio.cart.total} {formatPrice(cartTotal + (hasItem ? price : 0))})
                    </p>
                    {cart.map((it, idx) => (
                      <div key={it.key} className="flex items-center gap-3 px-4 py-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.preview} alt={`#${idx + 1}`} className="h-10 w-10 rounded-lg object-cover ring-1 ring-line" />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="truncate font-medium">
                            {t.product.forms[it.customization.form].label} · {variantLabel(t, it.customization.material, it.customization.metal)}
                            {it.designMode === "human" && ` · ${t.studio.human.badge}`}
                          </p>
                          <p className="text-xs text-muted">{formatPrice(it.price)}</p>
                        </div>
                        <button
                          onClick={() => removeFromCart(it.key)}
                          className="shrink-0 cursor-pointer text-xs text-muted hover:text-blush-deep"
                        >
                          {t.studio.cart.remove}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="text-sm font-medium text-foreground/80">
                    {t.studio.checkout.email}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.studio.checkout.emailPlaceholder}
                    className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label htmlFor="notes" className="text-sm font-medium text-foreground/80">
                    {t.studio.checkout.notes}
                  </label>
                  <textarea
                    id="notes"
                    value={c.notes}
                    onChange={(e) => setC({ ...c, notes: e.target.value })}
                    rows={3}
                    placeholder={t.studio.checkout.notesPlaceholder}
                    className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-gold"
                  />
                  <p className="mt-1 text-xs text-muted">{t.studio.checkout.notesHint}</p>
                </div>

                {hasItem && (
                  <button
                    onClick={addToCart}
                    disabled={checkingOut}
                    className="btn-ghost w-full cursor-pointer rounded-full px-6 py-3 text-sm font-medium disabled:opacity-50"
                  >
                    {t.studio.cart.addAnother}
                  </button>
                )}

                <button
                  onClick={checkout}
                  disabled={checkingOut || (!hasItem && cart.length === 0)}
                  className="btn-primary w-full cursor-pointer rounded-full px-6 py-4 text-base font-medium disabled:opacity-50"
                >
                  {checkingOut
                    ? t.studio.checkout.paying
                    : cart.length > 0
                      ? `${t.studio.cart.payAll} ${formatPrice(cartTotal + (hasItem ? price : 0))} (${cart.length + (hasItem ? 1 : 0)}${t.studio.cart.items})`
                      : `${t.studio.checkout.payPrefix} ${formatPrice(price)} ${t.studio.checkout.paySuffix}`}
                </button>
                <p className="text-center text-xs text-muted">{t.studio.checkout.secureNote}</p>
                {hasItem && (
                  <button onClick={() => setStep(3)} className="mx-auto block cursor-pointer text-sm text-muted hover:text-foreground">
                    {t.studio.checkout.backCustomize}
                  </button>
                )}
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
            e.target.value = "";
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
    <ol className="flex items-center justify-center gap-2 text-xs sm:gap-4 sm:text-sm" aria-label="progress">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              onClick={() => onJump(n)}
              disabled={n > step && !hasArt}
              aria-current={active ? "step" : undefined}
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

function MaterialPicker({
  t,
  c,
  onMaterial,
  onColour,
}: {
  t: Dict;
  c: Customization;
  onMaterial: (m: MaterialId) => void;
  onColour: (m: MetalId) => void;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl">{t.studio.material.title}</h2>
      <p className="mt-1 text-sm text-muted">{t.studio.material.sub}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {MATERIALS.map((m) => {
          const info = t.studio.material[m.id];
          const selected = c.material === m.id;
          return (
            <div
              key={m.id}
              className={`card relative px-4 pb-4 pt-5 text-left transition ${selected ? "ring-2 ring-rose/60" : "hover:border-gold-soft"}`}
            >
              <button
                onClick={() => onMaterial(m.id)}
                aria-pressed={selected}
                className="absolute inset-0 cursor-pointer rounded-[inherit]"
              >
                <span className="sr-only">{info.name}</span>
              </button>
              <span
                className={`absolute -top-2.5 left-3 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  selected ? "bg-rose text-white" : "border border-line bg-surface text-muted"
                }`}
              >
                {info.badge}
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{info.name}</p>
                <p className="font-display text-lg font-bold">{formatPrice(MATERIAL_PRICES[m.id])}</p>
              </div>
              <p className="mt-1 text-xs leading-snug text-muted">{info.desc}</p>
              <p className="mt-2 text-xs text-foreground/70">
                {m.forms.map((f) => t.product.forms[f].label).join(" / ")}
              </p>
              {info.warn && <p className="mt-2 text-xs leading-snug text-blush-deep">{info.warn}</p>}
              {selected && m.metals.length > 1 && (
                <div className="relative z-10 mt-3">
                  <span className="text-xs text-muted">{t.studio.material.colorLabel}</span>
                  <ColourChips metal={c.metal} onPick={onColour} only={m.metals} t={t} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Material (with price) + metal colour, used after the first preview. */
function VariantPicker({
  t,
  c,
  onMaterial,
  onColour,
  disabled = false,
  lockColour = false,
}: {
  t: Dict;
  c: Customization;
  onMaterial: (m: MaterialId) => void;
  onColour: (m: MetalId) => void;
  disabled?: boolean;
  /** The colour is fixed (AI version chosen): only materials offering it are selectable. */
  lockColour?: boolean;
}) {
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {MATERIALS.map((m) => {
          const unavailable = lockColour && !m.metals.includes(c.metal);
          return (
            <button
              key={m.id}
              onClick={() => onMaterial(m.id)}
              disabled={disabled || unavailable}
              aria-pressed={c.material === m.id}
              className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                c.material === m.id ? "border-rose bg-rose/10 font-medium" : "border-line hover:border-gold-soft"
              }`}
            >
              {t.product.materials[m.id].label}
              <span className="text-muted">{formatPrice(MATERIAL_PRICES[m.id])}</span>
            </button>
          );
        })}
      </div>
      {!lockColour && <ColourChips metal={c.metal} onPick={onColour} only={allowedMetals(c.material)} disabled={disabled} t={t} />}
    </div>
  );
}

function ColourChips({
  metal,
  onPick,
  disabled = false,
  only,
  t,
}: {
  metal: MetalId;
  onPick: (m: MetalId) => void;
  disabled?: boolean;
  only: MetalId[];
  t: Dict;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {METALS.filter((m) => only.includes(m.id)).map((m) => (
        <button
          key={m.id}
          onClick={() => onPick(m.id)}
          disabled={disabled}
          aria-pressed={metal === m.id}
          className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
            metal === m.id ? "border-rose bg-rose/10 font-medium" : "border-line hover:border-gold-soft"
          }`}
        >
          <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: m.swatch }} />
          {t.product.metals[m.id].label}
        </button>
      ))}
    </div>
  );
}

function VersionStrip({
  t,
  original,
  versions,
  selectedIdx,
  onSelect,
  generating,
}: {
  t: Dict;
  original: string;
  versions: Version[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  generating: boolean;
}) {
  return (
    <div className="card mt-5 p-3">
      <p className="px-1 text-xs font-medium text-muted">{t.studio.preview.versionsLabel}</p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        <figure className="shrink-0 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={original} alt={t.studio.preview.original} className="h-16 w-16 rounded-lg object-cover opacity-90 ring-1 ring-line" />
          <figcaption className="mt-1 text-[10px] text-muted">{t.studio.preview.original}</figcaption>
        </figure>
        <span className="mx-1 w-px shrink-0 self-stretch bg-line" aria-hidden />
        {versions.map((v, i) => (
          <button
            key={v.id ?? `local-${i}`}
            onClick={() => onSelect(i)}
            aria-pressed={i === selectedIdx}
            title={v.wish ?? undefined}
            className="shrink-0 cursor-pointer text-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.imageUrl}
              alt={`${t.studio.preview.attempt} ${i + 1}`}
              className={`h-16 w-16 rounded-lg object-cover transition ${
                i === selectedIdx ? "ring-2 ring-rose" : "ring-1 ring-line hover:ring-gold-soft"
              }`}
            />
            <span className={`mt-1 block text-[10px] ${i === selectedIdx ? "font-medium text-foreground" : "text-muted"}`}>
              {i === selectedIdx ? t.studio.preview.selectedBadge : `${t.studio.preview.attempt} ${i + 1}`}
            </span>
            {v.baseRound != null && versions.findIndex((x) => x.round === v.baseRound) >= 0 && (
              <span className="block text-[9px] text-muted">
                {t.studio.preview.fromVersion.replace(
                  "{n}",
                  String(versions.findIndex((x) => x.round === v.baseRound) + 1),
                )}
              </span>
            )}
          </button>
        ))}
        {generating && (
          <div className="shrink-0 text-center">
            <div className="skeleton h-16 w-16 rounded-lg" />
            <span className="mt-1 block text-[10px] text-muted">{t.studio.preview.retrying}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BaseOption({
  selected,
  disabled,
  onClick,
  img,
  label,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  img: string | null;
  label: string;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[56px] cursor-pointer items-center gap-2 rounded-xl border p-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? "border-rose bg-rose/10 font-medium" : "border-line hover:border-gold-soft"
      }`}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-line" />
      ) : (
        <span className="h-10 w-10 shrink-0 rounded-lg bg-line/40" />
      )}
      <span className="leading-snug">{label}</span>
    </button>
  );
}

function Uploader({ t, onPick, onDrop }: { t: Dict; onPick: () => void; onDrop: (f: File) => void }) {
  const [over, setOver] = useState(false);
  return (
    <section>
      <h2 className="font-display text-2xl">{t.studio.style.title}</h2>
      <p className="mt-1 text-sm text-muted">{t.studio.style.sub}</p>
      <div
        role="button"
        tabIndex={0}
        onClick={onPick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onPick();
        }}
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
        className={`mt-4 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
          over ? "border-rose bg-rose/5" : "border-line hover:border-gold-soft hover:bg-surface"
        }`}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full bg-rose/10">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="1.6" aria-hidden>
            <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
          </svg>
        </div>
        <p className="mt-4 font-medium">{t.studio.upload.dropTitle}</p>
        <p className="mt-1 text-xs text-muted">{t.studio.upload.dropHint}</p>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-muted">
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

function Segmented({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-2 inline-flex rounded-full border border-line bg-surface p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          disabled={disabled}
          aria-pressed={value === o.id}
          className={`min-h-[36px] cursor-pointer rounded-full px-4 py-1.5 transition-colors disabled:opacity-50 ${
            value === o.id ? "bg-rose/15 font-medium text-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string; sub?: string; delta: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={value === o.id}
            className={`card cursor-pointer px-3 py-3 text-left transition hover:border-gold-soft ${
              value === o.id ? "ring-2 ring-rose/60" : ""
            }`}
          >
            <span className="text-sm font-medium">{o.label}</span>
            {o.sub && <p className="mt-1 text-xs text-muted">{o.sub}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

function OrderSummary({ c, price, t, designMode }: { c: Customization; price: number; t: Dict; designMode: DesignMode }) {
  const rows = [
    [t.studio.summary.item, t.product.forms[c.form].label],
    [t.studio.summary.metal, variantLabel(t, c.material, c.metal)],
    [t.studio.summary.design, designMode === "human" ? t.studio.human.badge : t.studio.summary.designAi],
    c.form === "necklace" ? [t.studio.summary.chain, c.length] : null,
    c.engraving ? [t.studio.summary.engraving, `“${c.engraving}”`] : null,
  ].filter(Boolean) as [string, string][];
  return (
    <div className="card divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="text-muted">{k}</span>
          <span className="text-right font-medium">{v}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-muted">{t.studio.summary.totalShipping}</span>
        <span className="font-display text-xl">{formatPrice(price)}</span>
      </div>
    </div>
  );
}
