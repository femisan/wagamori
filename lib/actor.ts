import "server-only";
import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";

// Anonymous-preview cookie: lets a guest's single free preview be saved and then
// claimed by their account when they sign in to try again.
export const ANON_COOKIE = "wg_anon";

export type RequestActor = { userId: string | null; anonId: string; email: string | null };

/** Resolve the signed-in user (if any) and the guest cookie, creating the cookie if missing. */
export async function getActor(): Promise<RequestActor> {
  const jar = await cookies();
  let anonId = jar.get(ANON_COOKIE)?.value ?? "";
  if (!/^[a-z0-9-]{16,64}$/.test(anonId)) {
    anonId = crypto.randomUUID();
    jar.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }

  let userId: string | null = null;
  let email: string | null = null;
  if (process.env.CLERK_SECRET_KEY) {
    try {
      userId = (await auth()).userId ?? null;
      if (userId) {
        const u = await currentUser();
        email = u?.primaryEmailAddress?.emailAddress ?? u?.emailAddresses?.[0]?.emailAddress ?? null;
      }
    } catch {
      /* Clerk unavailable — treat as guest */
    }
  }
  return { userId, anonId, email };
}
