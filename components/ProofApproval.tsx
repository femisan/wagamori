"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./LangProvider";

export default function ProofApproval({ sessionId }: { sessionId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const p = t.track.proof;
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"approved" | "sent" | null>(null);

  const submit = async (action: "approve" | "changes") => {
    setBusy(true);
    try {
      const res = await fetch("/api/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action, comment }),
      });
      if (res.ok) {
        setDone(action === "approve" ? "approved" : "sent");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mt-4 rounded-xl border border-gold-soft bg-blush/15 px-4 py-3 text-sm text-foreground">
        {done === "approved" ? p.approved : p.sent}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {mode === "idle" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => submit("approve")}
            disabled={busy}
            className="btn-primary flex-1 cursor-pointer rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50"
          >
            {busy ? p.sending : p.approve}
          </button>
          <button
            onClick={() => setMode("changes")}
            disabled={busy}
            className="btn-ghost flex-1 cursor-pointer rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50"
          >
            {p.requestChanges}
          </button>
        </div>
      ) : (
        <div>
          <label className="text-sm font-medium text-foreground/80">{p.commentLabel}</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={p.commentPlaceholder}
            className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-gold"
          />
          <button
            onClick={() => submit("changes")}
            disabled={busy}
            className="btn-primary mt-2 w-full cursor-pointer rounded-full px-5 py-3 text-sm font-medium disabled:opacity-50"
          >
            {busy ? p.sending : p.requestChanges}
          </button>
        </div>
      )}
    </div>
  );
}
