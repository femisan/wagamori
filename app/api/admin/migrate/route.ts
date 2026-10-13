import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// One-time (idempotent) schema setup. Runs at runtime on Vercel where
// DATABASE_URL is available. Protected by ADMIN_TOKEN. Safe to re-run.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS designs (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id text NOT NULL,
     title text,
     status text NOT NULL DEFAULT 'draft',
     original_url text,
     selected_version_id uuid,
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS design_versions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     design_id uuid NOT NULL,
     round integer NOT NULL DEFAULT 0,
     source text NOT NULL DEFAULT 'ai',
     instruction text,
     image_url text NOT NULL,
     style text,
     metal text,
     subjects text,
     connection text,
     selected boolean NOT NULL DEFAULT false,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS orders (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     stripe_session_id text UNIQUE,
     user_id text,
     design_id uuid,
     email text,
     amount_jpy integer,
     status text NOT NULL DEFAULT 'received',
     tracking text,
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS showcase_posts (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id text NOT NULL,
     author_name text,
     image_url text NOT NULL,
     caption text,
     metal text,
     status text NOT NULL DEFAULT 'visible',
     likes integer NOT NULL DEFAULT 0,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `ALTER TABLE showcase_posts ADD COLUMN IF NOT EXISTS author_name text`,
  `ALTER TABLE showcase_posts ADD COLUMN IF NOT EXISTS source_url text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS artwork_url text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_url text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS spec text`,
  `CREATE TABLE IF NOT EXISTS blog_posts (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     slug text NOT NULL UNIQUE,
     title text NOT NULL,
     description text,
     cover_url text,
     body_html text NOT NULL,
     excerpt text,
     tags text,
     status text NOT NULL DEFAULT 'published',
     date text,
     created_at timestamp NOT NULL DEFAULT now(),
     updated_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status, date)`,
  // --- order flow v2: original-first designs, order items, marketing ---
  `ALTER TABLE designs ALTER COLUMN user_id DROP NOT NULL`,
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS anon_id text`,
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS email text`,
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS metal text`,
  `ALTER TABLE designs ADD COLUMN IF NOT EXISTS ordered_at timestamp`,
  `CREATE INDEX IF NOT EXISTS idx_designs_anon ON designs(anon_id)`,
  `CREATE INDEX IF NOT EXISTS idx_designs_status ON designs(status, updated_at)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_name text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_address text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code text`,
  `CREATE TABLE IF NOT EXISTS order_items (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     order_id uuid NOT NULL,
     design_id uuid,
     version_id uuid,
     artwork_url text,
     original_url text,
     metal text,
     form text,
     engraving text,
     notes text,
     price_jpy integer,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_design ON order_items(design_id)`,
  `CREATE TABLE IF NOT EXISTS marketing_contacts (
     email text PRIMARY KEY,
     user_id text,
     opt_in boolean NOT NULL DEFAULT false,
     opt_in_at timestamp,
     unsubscribed_at timestamp,
     updated_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS marketing_sends (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     email text NOT NULL,
     user_id text,
     design_id uuid,
     promo_code text,
     percent_off integer,
     expires_at timestamp,
     sent_by text,
     status text NOT NULL DEFAULT 'sent',
     error text,
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_marketing_sends_email ON marketing_sends(email, created_at)`,
  // --- reference-image choice + human designer handoff ---
  `ALTER TABLE design_versions ADD COLUMN IF NOT EXISTS base_version_id uuid`,
  `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS design_mode text NOT NULL DEFAULT 'ai'`,
  `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS design_brief text`,
  // --- material split from colour (silver can be gold / rose-gold plated) ---
  `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS material text`,
  `CREATE INDEX IF NOT EXISTS idx_designs_user ON designs(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_versions_design ON design_versions(design_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_showcase_status ON showcase_posts(status, created_at)`,
];

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!db) return NextResponse.json({ ok: false, error: "DATABASE_URL not set" }, { status: 503 });

  try {
    for (const stmt of STATEMENTS) {
      await db.execute(sql.raw(stmt));
    }
    const tables = await db.execute(
      sql.raw(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
      ),
    );
    return NextResponse.json({ ok: true, tables });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "migrate failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
