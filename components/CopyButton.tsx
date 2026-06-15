"use client";

import { useState } from "react";
import { useI18n } from "./LangProvider";

export default function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — no-op
    }
  };

  return (
    <button
      onClick={copy}
      className="btn-ghost cursor-pointer rounded-full px-4 py-2 text-xs font-medium"
    >
      {copied ? t.success.copied : t.success.copy}
    </button>
  );
}
