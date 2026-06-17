import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { designs, designVersions, orders } from "./schema";

type NewVersion = {
  designId: string;
  round: number;
  source: string;
  instruction?: string | null;
  imageUrl: string;
  style?: string | null;
  metal?: string | null;
  subjects?: string | null;
  connection?: string | null;
};

export async function createDesign(userId: string, originalUrl?: string | null) {
  if (!db) return null;
  const [d] = await db.insert(designs).values({ userId, originalUrl: originalUrl ?? null }).returning();
  return d;
}

export async function addVersion(v: NewVersion) {
  if (!db) return null;
  const [row] = await db.insert(designVersions).values(v).returning();
  await db.update(designs).set({ updatedAt: new Date() }).where(eq(designs.id, v.designId));
  return row;
}

export async function versionCount(designId: string): Promise<number> {
  if (!db) return 0;
  const rows = await db.select({ id: designVersions.id }).from(designVersions).where(eq(designVersions.designId, designId));
  return rows.length;
}

export async function listDesigns(userId: string) {
  if (!db) return [];
  return db.select().from(designs).where(eq(designs.userId, userId)).orderBy(desc(designs.updatedAt));
}

export async function listDesignsWithThumb(userId: string) {
  if (!db) return [];
  const ds = await db.select().from(designs).where(eq(designs.userId, userId)).orderBy(desc(designs.updatedAt));
  const out: Array<(typeof ds)[number] & { thumb: string | null; count: number }> = [];
  for (const d of ds) {
    const vs = await db
      .select()
      .from(designVersions)
      .where(eq(designVersions.designId, d.id))
      .orderBy(desc(designVersions.round));
    out.push({ ...d, thumb: vs[0]?.imageUrl ?? d.originalUrl, count: vs.length });
  }
  return out;
}

// --- admin-scoped (no user filter) ---
export async function listAllDesignsWithThumb() {
  if (!db) return [];
  const ds = await db.select().from(designs).orderBy(desc(designs.updatedAt)).limit(300);
  const out: Array<(typeof ds)[number] & { thumb: string | null; count: number }> = [];
  for (const d of ds) {
    const vs = await db
      .select()
      .from(designVersions)
      .where(eq(designVersions.designId, d.id))
      .orderBy(desc(designVersions.round));
    out.push({ ...d, thumb: vs[0]?.imageUrl ?? d.originalUrl, count: vs.length });
  }
  return out;
}

export async function getVersions(designId: string) {
  if (!db) return [];
  return db.select().from(designVersions).where(eq(designVersions.designId, designId)).orderBy(designVersions.round);
}

export async function adminSetSelected(designId: string, versionId: string) {
  if (!db) return false;
  await db.update(designVersions).set({ selected: false }).where(eq(designVersions.designId, designId));
  await db.update(designVersions).set({ selected: true }).where(eq(designVersions.id, versionId));
  await db.update(designs).set({ selectedVersionId: versionId, updatedAt: new Date() }).where(eq(designs.id, designId));
  return true;
}

export async function getDesign(id: string, userId: string) {
  if (!db) return null;
  const [d] = await db.select().from(designs).where(and(eq(designs.id, id), eq(designs.userId, userId)));
  if (!d) return null;
  const versions = await db
    .select()
    .from(designVersions)
    .where(eq(designVersions.designId, id))
    .orderBy(designVersions.round);
  return { ...d, versions };
}

export async function setSelectedVersion(designId: string, userId: string, versionId: string) {
  if (!db) return false;
  const [d] = await db.select().from(designs).where(and(eq(designs.id, designId), eq(designs.userId, userId)));
  if (!d) return false;
  await db.update(designVersions).set({ selected: false }).where(eq(designVersions.designId, designId));
  await db.update(designVersions).set({ selected: true }).where(eq(designVersions.id, versionId));
  await db.update(designs).set({ selectedVersionId: versionId, updatedAt: new Date() }).where(eq(designs.id, designId));
  return true;
}

export async function upsertOrder(o: {
  stripeSessionId: string;
  userId?: string | null;
  designId?: string | null;
  email?: string | null;
  amountJpy?: number | null;
  status?: string;
  artworkUrl?: string | null;
  originalUrl?: string | null;
  spec?: string | null;
}) {
  if (!db) return;
  await db
    .insert(orders)
    .values({ ...o, status: o.status ?? "received" })
    .onConflictDoUpdate({
      target: orders.stripeSessionId,
      set: {
        // Only overwrite userId when we actually have one (don't null it out
        // if a guest webhook fires after a logged-in checkout recorded it).
        ...(o.userId ? { userId: o.userId } : {}),
        designId: o.designId ?? null,
        email: o.email ?? null,
        amountJpy: o.amountJpy ?? null,
        status: o.status ?? "received",
        ...(o.artworkUrl ? { artworkUrl: o.artworkUrl } : {}),
        ...(o.originalUrl ? { originalUrl: o.originalUrl } : {}),
        ...(o.spec ? { spec: o.spec } : {}),
        updatedAt: new Date(),
      },
    });
}

/** A user's own orders, newest first (for the order-history page). */
export async function listOrdersByUser(userId: string) {
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

/** One order, scoped to its owner (for reorder). */
export async function getOrderForUser(id: string, userId: string) {
  if (!db) return null;
  const [row] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
  return row ?? null;
}
