import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { blogPosts } from "./schema";

export type BlogPost = typeof blogPosts.$inferSelect;

export async function listPublishedPosts(): Promise<BlogPost[]> {
  if (!db) return [];
  return db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"))
    .orderBy(desc(blogPosts.date), desc(blogPosts.createdAt));
}

export async function getPublishedPost(slug: string): Promise<BlogPost | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")));
  return row ?? null;
}

export async function adminListPosts(): Promise<BlogPost[]> {
  if (!db) return [];
  return db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
}

export async function upsertPost(p: {
  slug: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  bodyHtml: string;
  excerpt?: string | null;
  tags?: string | null;
  status?: string;
  date?: string | null;
}) {
  if (!db) return null;
  const [row] = await db
    .insert(blogPosts)
    .values({ ...p, status: p.status ?? "published" })
    .onConflictDoUpdate({
      target: blogPosts.slug,
      set: {
        title: p.title,
        description: p.description ?? null,
        coverUrl: p.coverUrl ?? null,
        bodyHtml: p.bodyHtml,
        excerpt: p.excerpt ?? null,
        tags: p.tags ?? null,
        status: p.status ?? "published",
        date: p.date ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function setPostStatus(slug: string, status: "published" | "draft") {
  if (!db) return null;
  const [row] = await db.update(blogPosts).set({ status, updatedAt: new Date() }).where(eq(blogPosts.slug, slug)).returning();
  return row;
}

export async function deletePost(slug: string) {
  if (!db) return false;
  await db.delete(blogPosts).where(eq(blogPosts.slug, slug));
  return true;
}
