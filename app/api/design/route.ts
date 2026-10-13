import { NextResponse } from "next/server";
import { getActor } from "@/lib/actor";
import { claimAnonDesigns, getDesignForActor, getVersions } from "@/lib/db/designs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Load one of the caller's designs (original + every attempt) to resume it in the studio. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const actor = await getActor();
  if (actor.userId) await claimAnonDesigns(actor.anonId, actor.userId, actor.email).catch(() => {});
  const design = await getDesignForActor(id, actor);
  if (!design) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const versions = (await getVersions(design.id)).map((v) => ({
    id: v.id,
    round: v.round,
    source: v.source,
    instruction: v.instruction,
    baseVersionId: v.baseVersionId,
    imageUrl: v.imageUrl,
    metal: v.metal,
    selected: v.selected,
  }));
  return NextResponse.json({
    ok: true,
    design: {
      id: design.id,
      originalUrl: design.originalUrl,
      metal: design.metal,
      selectedVersionId: design.selectedVersionId,
      status: design.status,
    },
    versions,
  });
}
