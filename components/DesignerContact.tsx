import { SITE } from "@/lib/site";
import type { Dict } from "@/lib/i18n";

/** Post-payment card for designer-made orders: how to reach the assigned designer. */
export default function DesignerContact({ t, orderId }: { t: Dict; orderId: string }) {
  const mailto = `mailto:${SITE.email}?subject=${encodeURIComponent(`[Wagamori] ${t.success.designer.title} ${orderId}`)}`;
  return (
    <section className="card w-full p-5 text-left">
      <h2 className="font-display text-xl">{t.success.designer.title}</h2>
      <p className="mt-2 text-sm text-muted">{t.success.designer.body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {SITE.lineUrl && (
          <a
            href={SITE.lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium"
          >
            {t.success.designer.line}
          </a>
        )}
        <a
          href={mailto}
          className={`${SITE.lineUrl ? "btn-ghost" : "btn-primary"} cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium`}
        >
          {t.success.designer.email}
        </a>
      </div>
    </section>
  );
}
