"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./LangProvider";

export default function VersionSelectButton({
  designId,
  versionId,
  selected,
}: {
  designId: string;
  versionId: string;
  selected: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (selected) {
    return (
      <span className="rounded-full bg-rose/15 px-3 py-1.5 text-xs font-medium text-foreground">
        ✓ {t.myDesigns.selected}
      </span>
    );
  }

  const onClick = async () => {
    setBusy(true);
    try {
      await fetch("/api/design/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId, versionId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="btn-ghost cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50"
    >
      {t.myDesigns.useThisVersion}
    </button>
  );
}
