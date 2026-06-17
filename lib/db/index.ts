import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// DB is optional until DATABASE_URL (Neon) is provisioned — everything that
// uses it must no-op gracefully when `db` is null, so the app never breaks.
const url = process.env.DATABASE_URL;
export const db = url ? drizzle(neon(url), { schema }) : null;
export const hasDb = !!db;
export { schema };
