import "server-only";
import { desc, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { designs, designVersions, marketingContacts, marketingSends } from "./schema";

export type LeadRow = {
  designId: string;
  userId: string | null;
  email: string | null;
  status: string; // draft | ordered
  metal: string | null;
  originalUrl: string | null;
  thumb: string | null;
  attempts: number; // AI generations from the original
  createdAt: Date;
  updatedAt: Date;
  orderedAt: Date | null;
  optIn: boolean;
  unsubscribed: boolean;
  lastSentAt: Date | null;
  lastPromo: string | null;
};

/** Every design with its attempt count + marketing state — the admin "leads" view. */
export async function listLeads(limit = 500): Promise<LeadRow[]> {
  if (!db) return [];
  const ds = await db.select().from(designs).orderBy(desc(designs.updatedAt)).limit(limit);
  if (ds.length === 0) return [];
  const ids = ds.map((d) => d.id);

  const vs = await db
    .select({
      designId: designVersions.designId,
      imageUrl: designVersions.imageUrl,
      source: designVersions.source,
      round: designVersions.round,
    })
    .from(designVersions)
    .where(inArray(designVersions.designId, ids))
    .orderBy(desc(designVersions.round));
  const thumb = new Map<string, string>();
  const attempts = new Map<string, number>();
  for (const v of vs) {
    if (!thumb.has(v.designId)) thumb.set(v.designId, v.imageUrl);
    if (v.source !== "cs") attempts.set(v.designId, (attempts.get(v.designId) ?? 0) + 1);
  }

  const emails = [...new Set(ds.map((d) => d.email).filter(Boolean))] as string[];
  const contacts = emails.length
    ? await db.select().from(marketingContacts).where(inArray(marketingContacts.email, emails))
    : [];
  const contactBy = new Map(contacts.map((c) => [c.email, c]));

  const sends = emails.length
    ? await db
        .select({
          email: marketingSends.email,
          at: sql<Date>`max(${marketingSends.createdAt})`,
          promo: sql<string>`(array_agg(${marketingSends.promoCode} order by ${marketingSends.createdAt} desc))[1]`,
        })
        .from(marketingSends)
        .where(inArray(marketingSends.email, emails))
        .groupBy(marketingSends.email)
    : [];
  const sendBy = new Map(sends.map((s) => [s.email, s]));

  return ds.map((d) => {
    const c = d.email ? contactBy.get(d.email) : undefined;
    const s = d.email ? sendBy.get(d.email) : undefined;
    return {
      designId: d.id,
      userId: d.userId,
      email: d.email,
      status: d.status,
      metal: d.metal,
      originalUrl: d.originalUrl,
      thumb: thumb.get(d.id) ?? d.originalUrl,
      attempts: attempts.get(d.id) ?? 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      orderedAt: d.orderedAt,
      optIn: !!c?.optIn && !c.unsubscribedAt,
      unsubscribed: !!c?.unsubscribedAt,
      lastSentAt: s?.at ? new Date(s.at) : null,
      lastPromo: s?.promo ?? null,
    };
  });
}

/** Record (or refresh) a customer's marketing consent. Never re-subscribes someone who opted out. */
export async function setMarketingConsent(email: string, userId: string | null, optIn: boolean) {
  if (!db || !email) return;
  const now = new Date();
  await db
    .insert(marketingContacts)
    .values({ email, userId, optIn, optInAt: optIn ? now : null, updatedAt: now })
    .onConflictDoUpdate({
      target: marketingContacts.email,
      set: optIn
        ? {
            userId,
            optIn: sql`case when ${marketingContacts.unsubscribedAt} is null then true else ${marketingContacts.optIn} end`,
            optInAt: sql`coalesce(${marketingContacts.optInAt}, now())`,
            updatedAt: now,
          }
        : { userId, optIn: false, updatedAt: now },
    });
}

export async function unsubscribe(email: string) {
  if (!db || !email) return;
  const now = new Date();
  await db
    .insert(marketingContacts)
    .values({ email, optIn: false, unsubscribedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: marketingContacts.email,
      set: { optIn: false, unsubscribedAt: now, updatedAt: now },
    });
}

export async function contactsByEmails(emails: string[]) {
  if (!db || emails.length === 0) return [];
  return db.select().from(marketingContacts).where(inArray(marketingContacts.email, emails));
}

export async function recordSend(s: typeof marketingSends.$inferInsert) {
  if (!db) return;
  await db.insert(marketingSends).values(s);
}
