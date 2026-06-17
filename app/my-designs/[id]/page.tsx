import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VersionSelectButton from "@/components/VersionSelectButton";
import { getDesign } from "@/lib/db/designs";
import { getServerT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Design history" };

export default async function DesignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getServerT();
  const { id } = await params;
  const { userId } = await auth();
  const design = userId ? await getDesign(id, userId) : null;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 md:py-14">
        <Link href="/my-designs" className="text-sm text-muted hover:text-foreground">
          {t.myDesigns.back}
        </Link>

        {!design ? (
          <div className="card mt-6 px-5 py-8 text-sm text-muted">—</div>
        ) : (
          <>
            <h1 className="mt-3 font-display text-3xl">{t.myDesigns.history}</h1>

            {design.originalUrl && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm text-muted">{t.myDesigns.original}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={design.originalUrl}
                  alt="original"
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-line"
                />
              </div>
            )}

            <ol className="mt-6 space-y-4">
              {design.versions.map((v) => {
                const isSelected = v.selected || design.selectedVersionId === v.id;
                return (
                  <li key={v.id} className="card flex gap-4 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.imageUrl}
                      alt={`version ${v.round}`}
                      className="h-24 w-24 shrink-0 rounded-xl bg-blush/10 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        #{v.round} · {v.source}
                      </p>
                      {v.instruction && <p className="mt-1 text-sm">“{v.instruction}”</p>}
                      <div className="mt-2">
                        <VersionSelectButton designId={design.id} versionId={v.id} selected={isSelected} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
