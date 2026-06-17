import "server-only";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { db } from "./index";
import { showcasePosts } from "./schema";

export type ShowcasePost = typeof showcasePosts.$inferSelect;

export async function createShowcasePost(v: {
  userId: string;
  authorName?: string | null;
  imageUrl: string;
  sourceUrl?: string | null;
  caption?: string | null;
  metal?: string | null;
  likes?: number; // seed posts can start with a like count
}) {
  if (!db) return null;
  const [row] = await db
    .insert(showcasePosts)
    .values({
      userId: v.userId,
      authorName: v.authorName ?? null,
      imageUrl: v.imageUrl,
      sourceUrl: v.sourceUrl ?? null,
      caption: v.caption ?? null,
      metal: v.metal ?? null,
      ...(typeof v.likes === "number" ? { likes: v.likes } : {}),
    })
    .returning();
  return row;
}

/** Remove all seeded posts (userId starts with "seed_"), for clean re-seeding. */
export async function deleteSeedPosts() {
  if (!db) return 0;
  const rows = await db.delete(showcasePosts).where(like(showcasePosts.userId, "seed\\_%")).returning({ id: showcasePosts.id });
  return rows.length;
}

/** Public, visible posts — newest first. */
export async function listShowcase(limit = 24, offset = 0): Promise<ShowcasePost[]> {
  if (!db) return [];
  return db
    .select()
    .from(showcasePosts)
    .where(eq(showcasePosts.status, "visible"))
    .orderBy(desc(showcasePosts.createdAt))
    .limit(limit)
    .offset(offset);
}

/** A few most-liked visible posts for the homepage teaser. */
export async function topShowcase(limit = 6): Promise<ShowcasePost[]> {
  if (!db) return [];
  return db
    .select()
    .from(showcasePosts)
    .where(eq(showcasePosts.status, "visible"))
    .orderBy(desc(showcasePosts.likes), desc(showcasePosts.createdAt))
    .limit(limit);
}

/** Increment the like counter; returns the new total (or null). */
export async function likeShowcase(id: string): Promise<number | null> {
  if (!db) return null;
  const [row] = await db
    .update(showcasePosts)
    .set({ likes: sql`${showcasePosts.likes} + 1` })
    .where(and(eq(showcasePosts.id, id), eq(showcasePosts.status, "visible")))
    .returning({ likes: showcasePosts.likes });
  return row?.likes ?? null;
}

/* ---------- admin ---------- */

export async function adminListShowcase(): Promise<ShowcasePost[]> {
  if (!db) return [];
  return db.select().from(showcasePosts).orderBy(desc(showcasePosts.createdAt));
}

export async function setShowcaseStatus(id: string, status: "visible" | "hidden") {
  if (!db) return null;
  const [row] = await db.update(showcasePosts).set({ status }).where(eq(showcasePosts.id, id)).returning();
  return row;
}

export async function deleteShowcasePost(id: string) {
  if (!db) return false;
  await db.delete(showcasePosts).where(eq(showcasePosts.id, id));
  return true;
}
