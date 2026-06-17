import "server-only";
import { currentUser } from "@clerk/nextjs/server";

export type Role = "admin" | "staff";

/** Read the signed-in user's role from Clerk publicMetadata.role. */
export async function getRole(): Promise<Role | null> {
  const u = await currentUser();
  const r = (u?.publicMetadata as { role?: string } | undefined)?.role;
  return r === "admin" || r === "staff" ? r : null;
}

export async function isAdmin(): Promise<boolean> {
  return (await getRole()) === "admin";
}

/** Staff + admin may edit fulfillment (status/tracking/CS draft). */
export async function canManage(): Promise<boolean> {
  const r = await getRole();
  return r === "admin" || r === "staff";
}
