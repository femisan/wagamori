"use client";

import { useState } from "react";
import { useI18n } from "./LangProvider";

export default function ReorderButton({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const reorder = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const j = await res.json();
      if (j.url) window.location.href = j.url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={reorder}
      disabled={loading}
      className="btn-primary shrink-0 cursor-pointer rounded-full px-4 py-2 text-xs font-medium disabled:opacity-50"
    >
      {loading ? t.myOrders.reordering : t.myOrders.reorder}
    </button>
  );
}
