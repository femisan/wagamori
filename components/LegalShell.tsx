import Header from "./Header";
import Footer from "./Footer";

/** Shared layout for legal pages (特商法 / プライバシー / 利用規約). */
export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 md:py-14">
        <h1 className="font-display text-3xl">{title}</h1>
        {updated && <p className="mt-2 text-xs text-muted">{updated}</p>}
        <div className="mt-8 space-y-7 text-sm leading-relaxed text-foreground/80">{children}</div>
      </main>
      <Footer />
    </>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg text-foreground">{heading}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
