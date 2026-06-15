"use client";

import { useState } from "react";
import { useI18n } from "./LangProvider";

export default function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto max-w-2xl divide-y divide-line">
      {t.faq.items.map((f, i) => (
        <div key={f.q}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left"
          >
            <span className="font-medium">{f.q}</span>
            <span className={`text-rose transition-transform ${open === i ? "rotate-45" : ""}`}>+</span>
          </button>
          <div
            className={`grid overflow-hidden text-sm text-muted transition-all ${
              open === i ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0">{f.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
