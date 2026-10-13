import { SITE } from "@/lib/site";
import type { Dict } from "@/lib/i18n";

/** Post-payment card for designer-made orders: reach the assigned designer by email. */
export default function DesignerContact({ t, orderId }: { t: Dict; orderId: string }) {
  const mailto = `mailto:${SITE.email}?subject=${encodeURIComponent(`[Wagamori] ${t.success.designer.title} ${orderId}`)}`;
  return (
    <section className="card w-full p-5 text-left">
      <h2 className="font-display text-xl">{t.success.designer.title}</h2>
      <p className="mt-2 text-sm text-muted">{t.success.designer.body}</p>
      <a
        href={mailto}
        className="btn-primary mt-4 inline-block cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium"
      >
        {t.success.designer.email}
      </a>
      <p className="mt-2 break-all text-xs text-muted">{SITE.email}</p>
    </section>
  );
}
