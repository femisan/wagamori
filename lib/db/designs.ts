import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import { designs, designVersions, orders, orderItems } from "./schema";

type NewVersion = {
  designId: string;
  round: number;
  source: string;
  instruction?: string | null;
  baseVersionId?: string | null;
  imageUrl: string;
  style?: string | null;
  metal?: string | null;
  subjects?: string | null;
  connection?: string | null;
};

/** Who is acting: a signed-in Clerk user and/or the anonymous-preview cookie. */
export type Actor = { userId?: string | null; anonId?: string | null };

export async function createDesign(d: {
  userId?: string | null;
  anonId?: string | null;
  email?: string | null;
  originalUrl: string | null;
  metal?: string | null;
}) {
  if (!db) return null;
  const [row] = await db
    .insert(designs)
    .values({
      userId: d.userId ?? null,
      anonId: d.userId ? null : d.anonId ?? null,
      email: d.email ?? null,
      originalUrl: d.originalUrl,
      metal: d.metal ?? null,
    })
    .returning();
  return row;
}

/** A design the actor may use: their own, or an unclaimed guest design from this browser. */
export async function getDesignForActor(id: string, actor: Actor) {
  if (!db || !id) return null;
  const [d] = await db.select().from(designs).where(eq(designs.id, id));
  if (!d) return null;
  if (actor.userId && d.userId === actor.userId) return d;
  if (!d.userId && actor.anonId && d.anonId === actor.anonId) return d;
  return null;
}

/** Attach a browser's anonymous designs to the account that just signed in. */
export async function claimAnonDesigns(anonId: string, userId: string, email?: string | null) {
  if (!db || !anonId) return;
  await db
    .update(designs)
    .set({ userId, email: email ?? null, anonId: null, updatedAt: new Date() })
    .where(and(eq(designs.anonId, anonId), isNull(designs.userId)));
}

/** Number of AI attempts already made on anonymous designs from this browser. */
export async function anonAttemptCount(anonId: string): Promise<number> {
  if (!db || !anonId) return 0;
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(designVersions)
    .innerJoin(designs, eq(designs.id, designVersions.designId))
    .where(and(eq(designs.anonId, anonId), isNull(designs.userId), eq(designVersions.source, "ai")));
  return rows[0]?.n ?? 0;
}

export async function touchDesign(id: string, patch: { email?: string | null; metal?: string | null }) {
  if (!db) return;
  await db
    .update(designs)
    .set({
      ...(patch.email ? { email: patch.email } : {}),
      ...(patch.metal ? { metal: patch.metal } : {}),
      updatedAt: new Date(),
    })
    .where(eq(designs.id, id));
}

export async function addVersion(v: NewVersion) {
  if (!db) return null;
  const [row] = await db.insert(designVersions).values(v).returning();
  await db.update(designs).set({ updatedAt: new Date() }).where(eq(designs.id, v.designId));
  return row;
}

/** Next round number (max + 1) — robust even if rows were ever deleted. */
export async function nextRound(designId: string): Promise<number> {
  if (!db) return 0;
  const rows = await db
    .select({ r: sql<number>`coalesce(max(${designVersions.round}), -1)::int` })
    .from(designVersions)
    .where(eq(designVersions.designId, designId));
  return (rows[0]?.r ?? -1) + 1;
}

/** @deprecated kept for older callers — use nextRound */
export const versionCount = nextRound;

async function withThumbs<T extends { id: string; originalUrl: string | null }>(ds: T[]) {
  if (!db || ds.length === 0) return ds.map((d) => ({ ...d, thumb: d.originalUrl, count: 0 }));
  const vs = await db
    .select({ designId: designVersions.designId, imageUrl: designVersions.imageUrl, round: designVersions.round })
    .from(designVersions)
    .where(inArray(designVersions.designId, ds.map((d) => d.id)))
    .orderBy(desc(designVersions.round));
  const latest = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const v of vs) {
    if (!latest.has(v.designId)) latest.set(v.designId, v.imageUrl);
    counts.set(v.designId, (counts.get(v.designId) ?? 0) + 1);
  }
  return ds.map((d) => ({ ...d, thumb: latest.get(d.id) ?? d.originalUrl, count: counts.get(d.id) ?? 0 }));
}

export async function listDesignsWithThumb(userId: string) {
  if (!db) return [];
  const ds = await db.select().from(designs).where(eq(designs.userId, userId)).orderBy(desc(designs.updatedAt));
  return withThumbs(ds);
}

export async function getVersions(designId: string) {
  if (!db) return [];
  return db.select().from(designVersions).where(eq(designVersions.designId, designId)).orderBy(designVersions.round);
}

export async function getVersion(versionId: string) {
  if (!db || !versionId) return null;
  const [v] = await db.select().from(designVersions).where(eq(designVersions.id, versionId));
  return v ?? null;
}

async function setSelected(designId: string, versionId: string) {
  if (!db) return;
  await db.update(designVersions).set({ selected: false }).where(eq(designVersions.designId, designId));
  await db
    .update(designVersions)
    .set({ selected: true })
    .where(and(eq(designVersions.id, versionId), eq(designVersions.designId, designId)));
  await db.update(designs).set({ selectedVersionId: versionId, updatedAt: new Date() }).where(eq(designs.id, designId));
}

export async function adminSetSelected(designId: string, versionId: string) {
  if (!db) return false;
  await setSelected(designId, versionId);
  return true;
}

export async function getDesign(id: string, userId: string) {
  if (!db) return null;
  const [d] = await db.select().from(designs).where(and(eq(designs.id, id), eq(designs.userId, userId)));
  if (!d) return null;
  return { ...d, versions: await getVersions(id) };
}

export async function setSelectedVersion(designId: string, userId: string, versionId: string) {
  if (!db) return false;
  const [d] = await db.select().from(designs).where(and(eq(designs.id, designId), eq(designs.userId, userId)));
  if (!d) return false;
  await setSelected(designId, versionId);
  return true;
}

// ---------------------------------------------------------------- orders

export type PendingItem = {
  designId?: string | null;
  versionId?: string | null;
  artworkUrl?: string | null;
  originalUrl?: string | null;
  material: string;
  metal: string;
  form: string;
  engraving?: string | null;
  notes?: string | null;
  designMode?: "ai" | "human";
  designBrief?: string | null;
  priceJpy: number;
};

/** Create the order + its items before redirecting to Stripe (status 'pending'). */
export async function createPendingOrder(o: {
  userId?: string | null;
  email?: string | null;
  items: PendingItem[];
}) {
  if (!db || o.items.length === 0) return null;
  const first = o.items[0];
  const [order] = await db
    .insert(orders)
    .values({
      userId: o.userId ?? null,
      email: o.email ?? null,
      designId: first.designId ?? null,
      amountJpy: o.items.reduce((s, it) => s + it.priceJpy, 0),
      status: "pending",
      artworkUrl: first.artworkUrl ?? null,
      originalUrl: first.originalUrl ?? null,
      spec: JSON.stringify({
        material: first.material,
        form: first.form,
        style: "enamel",
        metal: first.metal,
        engraving: first.engraving ?? "",
      }),
    })
    .returning();
  await db.insert(orderItems).values(
    o.items.map((it) => ({
      orderId: order.id,
      designId: it.designId ?? null,
      versionId: it.versionId ?? null,
      artworkUrl: it.artworkUrl ?? null,
      originalUrl: it.originalUrl ?? null,
      material: it.material,
      metal: it.metal,
      form: it.form,
      engraving: it.engraving ?? null,
      notes: it.notes ?? null,
      designMode: it.designMode ?? "ai",
      designBrief: it.designBrief ?? null,
      priceJpy: it.priceJpy,
    })),
  );
  return order;
}

export async function attachStripeSession(orderId: string, sessionId: string) {
  if (!db) return;
  await db.update(orders).set({ stripeSessionId: sessionId, updatedAt: new Date() }).where(eq(orders.id, orderId));
}

/** Payment confirmed → flip the order to 'received' and mark its designs as ordered. */
export async function markOrderPaid(
  orderId: string,
  p: {
    stripeSessionId: string;
    email?: string | null;
    amountJpy?: number | null;
    shipName?: string | null;
    shipAddress?: string | null;
    phone?: string | null;
    promoCode?: string | null;
  },
) {
  if (!db) return;
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return;
  await db
    .update(orders)
    .set({
      stripeSessionId: p.stripeSessionId,
      // Keep a fulfillment status the admin already advanced; only lift 'pending'.
      status: o.status === "pending" ? "received" : o.status,
      ...(p.email ? { email: p.email } : {}),
      ...(p.amountJpy != null ? { amountJpy: p.amountJpy } : {}),
      ...(p.shipName ? { shipName: p.shipName } : {}),
      ...(p.shipAddress ? { shipAddress: p.shipAddress } : {}),
      ...(p.phone ? { phone: p.phone } : {}),
      ...(p.promoCode ? { promoCode: p.promoCode } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const designIds = [...new Set(items.map((i) => i.designId).filter(Boolean))] as string[];
  if (designIds.length) {
    await db
      .update(designs)
      .set({ status: "ordered", orderedAt: new Date(), updatedAt: new Date() })
      .where(inArray(designs.id, designIds));
  }
}

/** Legacy path (orders created before order_items existed / no orderId in metadata). */
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
        ...(o.userId ? { userId: o.userId } : {}),
        designId: o.designId ?? null,
        email: o.email ?? null,
        amountJpy: o.amountJpy ?? null,
        ...(o.artworkUrl ? { artworkUrl: o.artworkUrl } : {}),
        ...(o.originalUrl ? { originalUrl: o.originalUrl } : {}),
        ...(o.spec ? { spec: o.spec } : {}),
        updatedAt: new Date(),
      },
    });
}

/** Items for a set of orders, keyed by orderId. */
export async function itemsByOrder(orderIds: string[]) {
  const out = new Map<string, (typeof orderItems.$inferSelect)[]>();
  if (!db || orderIds.length === 0) return out;
  const rows = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)).orderBy(orderItems.createdAt);
  for (const r of rows) out.set(r.orderId, [...(out.get(r.orderId) ?? []), r]);
  return out;
}

/** Orders by Stripe session id (admin list enrichment). */
export async function ordersBySessionIds(sessionIds: string[]) {
  if (!db || sessionIds.length === 0) return [];
  return db.select().from(orders).where(inArray(orders.stripeSessionId, sessionIds));
}

/** A user's own paid orders, newest first (for the order-history page). */
export async function listOrdersByUser(userId: string) {
  if (!db) return [];
  const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  return rows.filter((r) => r.status !== "pending");
}

/** One order, scoped to its owner (for reorder). */
export async function getOrderForUser(id: string, userId: string) {
  if (!db) return null;
  const [row] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
  return row ?? null;
}
