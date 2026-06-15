"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./LangProvider";

interface Props {
  token: string;
  sessionId: string;
  initialStatus?: string;
  initialTracking?: string;
  proof?: string;
  feedback?: string;
  approved?: boolean;
}

const STAGES = ["received", "proof", "crafting", "shipped"] as const;

export default function AdminStatusForm({
  token,
  sessionId,
  initialStatus,
  initialTracking,
  proof,
  feedback,
  approved,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus || "received");
  const [tracking, setTracking] = useState(initialTracking || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const fileToDataUrl = (f: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(f);
    });

  const submit = async () => {
    setSaving(true);
    setSaved(false);
    try {
      let proofUrl: string | undefined;
      const file = fileRef.current?.files?.[0];
      let nextStatus = status;
      if (file) {
        const dataUrl = await fileToDataUrl(file);
        const up = await fetch("/api/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl, kind: "proof" }),
        }).then((r) => r.json());
        if (up.ok && up.url?.startsWith("http")) {
          proofUrl = up.url;
          nextStatus = "proof"; // uploading a proof moves the order to review
          setStatus("proof");
        }
      }
      const res = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, sessionId, fulfillment: nextStatus, tracking, proof: proofUrl }),
      });
      if (res.ok) {
        setSaved(true);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {/* customer signals */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {approved && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">{t.admin.approvedBadge}</span>
        )}
        {proof?.startsWith("http") && (
          <a href={proof} target="_blank" rel="noopener noreferrer" className="text-rose underline">
            {t.admin.proofUploaded}
          </a>
        )}
      </div>
      {feedback && (
        <p className="rounded-lg bg-blush/20 px-3 py-2 text-xs text-foreground">
          <span className="text-muted">{t.admin.feedbackLabel}: </span>
          {feedback}
        </p>
      )}

      {/* proof upload */}
      <label className="block text-xs text-muted">
        {t.admin.proofLabel}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="mt-1 block w-full text-xs text-foreground file:mr-2 file:cursor-pointer file:rounded-full file:border-0 file:bg-rose/15 file:px-3 file:py-1.5 file:text-foreground"
        />
      </label>
      <p className="text-[11px] text-muted">{t.admin.proofUpload}</p>

      {/* status + tracking */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          {t.admin.statusLabel}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block cursor-pointer rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {t.admin.statusOptions[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          {t.admin.trackingLabel}
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className="mt-1 block w-44 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={submit}
          disabled={saving}
          className="btn-primary cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {t.admin.save}
        </button>
        {saved && <span className="text-xs text-green-700">{t.admin.saved}</span>}
      </div>
    </div>
  );
}
