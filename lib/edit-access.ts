import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";

export interface EditAccess {
  ok: boolean;
  reason?: "unauthorized" | "rate_limited";
  remaining: number | null;
}

// Per-user daily cap on AI edits (effectively unlimited for real use, but
// blocks runaway cost / abuse). Counter lives in the Clerk user's private
// metadata — no extra database needed.
const DAILY_LIMIT = 50;

export async function requireEditAccess(): Promise<EditAccess> {
  if (!process.env.CLERK_SECRET_KEY) {
    return { ok: false, reason: "unauthorized", remaining: 0 };
  }
  const { userId } = await auth();
  if (!userId) return { ok: false, reason: "unauthorized", remaining: 0 };

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const md = (user.privateMetadata ?? {}) as { editDay?: string; editCount?: number };
    const today = new Date().toISOString().slice(0, 10);
    const count = md.editDay === today ? md.editCount ?? 0 : 0;
    if (count >= DAILY_LIMIT) return { ok: false, reason: "rate_limited", remaining: 0 };
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { editDay: today, editCount: count + 1 },
    });
    return { ok: true, remaining: DAILY_LIMIT - (count + 1) };
  } catch {
    // If the metadata check fails, allow the edit (don't block a paying user).
    return { ok: true, remaining: null };
  }
}
