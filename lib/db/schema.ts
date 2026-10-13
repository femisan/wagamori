import { pgTable, text, timestamp, integer, boolean, uuid } from "drizzle-orm/pg-core";

// A customer's design (one per uploaded photo / project). The original upload is
// kept forever; every AI attempt is generated fresh FROM THAT ORIGINAL (never
// chained off a previous AI image), so attempts don't drift.
export const designs = pgTable("designs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"), // Clerk user id (null while an anonymous first preview)
  anonId: text("anon_id"), // cookie id for a guest's first preview, claimed on login
  email: text("email"), // Clerk primary email, captured when the user generates
  title: text("title"),
  status: text("status").default("draft").notNull(), // draft | ordered
  originalUrl: text("original_url"), // the uploaded photo (Vercel Blob)
  metal: text("metal"), // last material/colour the customer generated with
  selectedVersionId: uuid("selected_version_id"), // which version is the chosen/final draft
  orderedAt: timestamp("ordered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Every AI attempt / CS revision — full history, so any past version can be
// re-selected and CS manual drafts are tracked.
export const designVersions = pgTable("design_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  designId: uuid("design_id").notNull(),
  round: integer("round").default(0).notNull(),
  source: text("source").default("ai").notNull(), // ai | cs (legacy: edit | customer)
  instruction: text("instruction"), // customer's wish for this attempt / CS note
  baseVersionId: uuid("base_version_id"), // null = generated from the original; else refined from this version
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
  spec: text("spec"), // JSON of the first item's Customization (legacy single-item)
  shipName: text("ship_name"),
  shipAddress: text("ship_address"), // multi-line, label-ready
  phone: text("phone"),
  promoCode: text("promo_code"), // discount code used at checkout, if any
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// One row per piece in an order (an order can hold several designs).
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull(),
  designId: uuid("design_id"),
  versionId: uuid("version_id"),
  artworkUrl: text("artwork_url"), // the AI/CS version being produced
  originalUrl: text("original_url"), // the customer's original upload
  material: text("material"), // alloy | silver
  metal: text("metal"), // colour: gold | rosegold | silver
  form: text("form"),
  engraving: text("engraving"),
  notes: text("notes"),
  designMode: text("design_mode").default("ai").notNull(), // ai | human (customer asked for a designer)
  designBrief: text("design_brief"), // what the customer wants the designer to do
  priceJpy: integer("price_jpy"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Who may receive marketing email (特定電子メール法: opt-in + easy opt-out).
export const marketingContacts = pgTable("marketing_contacts", {
  email: text("email").primaryKey(),
  userId: text("user_id"),
  optIn: boolean("opt_in").default(false).notNull(),
  optInAt: timestamp("opt_in_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Log of discount/marketing emails sent from the admin (one row per recipient).
export const marketingSends = pgTable("marketing_sends", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  userId: text("user_id"),
  designId: uuid("design_id"),
  promoCode: text("promo_code"),
  percentOff: integer("percent_off"),
  expiresAt: timestamp("expires_at"),
  sentBy: text("sent_by"),
  status: text("status").default("sent").notNull(), // sent | failed
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
