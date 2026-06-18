import { pgTable, text, timestamp, integer, boolean, uuid } from "drizzle-orm/pg-core";

// A customer's design (one per uploaded photo / project).
export const designs = pgTable("designs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(), // Clerk user id
  title: text("title"),
  status: text("status").default("draft").notNull(), // draft | ordered | in_production | shipped
  originalUrl: text("original_url"), // the uploaded photo (Vercel Blob)
  selectedVersionId: uuid("selected_version_id"), // which version is the chosen/final draft
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Every generation / edit / CS revision — full history, so any past version
// can be re-selected (e.g. "go back to v1") and CS manual drafts are tracked.
export const designVersions = pgTable("design_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  designId: uuid("design_id").notNull(),
  round: integer("round").default(0).notNull(),
  source: text("source").default("ai").notNull(), // ai | edit | cs | customer
  instruction: text("instruction"), // chat prompt / CS note
  imageUrl: text("image_url").notNull(), // Vercel Blob URL
  style: text("style"),
  metal: text("metal"),
  subjects: text("subjects"),
  connection: text("connection"),
  selected: boolean("selected").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Buyer-show gallery: customers upload photos of the real piece they received.
// Auto-published (status 'visible'); admin can hide. Likes are anonymous
// (a simple counter; the client dedupes per-device via localStorage).
export const showcasePosts = pgTable("showcase_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(), // Clerk uploader (or "seed_*" for seeded posts)
  authorName: text("author_name"), // display name shown on the card
  imageUrl: text("image_url").notNull(), // the finished piece (Vercel Blob URL)
  sourceUrl: text("source_url"), // the original drawing/photo, shown as a small inset
  caption: text("caption"),
  metal: text("metal"), // optional finish tag (gold | silver | rosegold)
  status: text("status").default("visible").notNull(), // visible | hidden
  likes: integer("likes").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Blog posts — uploaded as a zip from the admin (markdown/html + images),
// stored here so they appear instantly without a redeploy.
export const blogPosts = pgTable("blog_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  bodyHtml: text("body_html").notNull(), // rendered HTML (from md or provided html)
  excerpt: text("excerpt"),
  tags: text("tags"), // comma-separated
  status: text("status").default("published").notNull(), // published | draft
  date: text("date"), // YYYY-MM-DD (display/sort)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Orders, linked to Stripe + the design. Mirrors key fields for fast admin
// filtering/sorting (Stripe stays the source of truth for payment).
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  stripeSessionId: text("stripe_session_id").unique(),
  userId: text("user_id"),
  designId: uuid("design_id"),
  email: text("email"),
  amountJpy: integer("amount_jpy"),
  status: text("status").default("received").notNull(),
  tracking: text("tracking"),
  artworkUrl: text("artwork_url"), // the finished pendant art (Blob URL)
  originalUrl: text("original_url"), // the customer's original upload
  spec: text("spec"), // JSON of the Customization, for display + reorder
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
