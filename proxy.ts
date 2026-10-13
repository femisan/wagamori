import { clerkMiddleware } from "@clerk/nextjs/server";

// Enable Clerk so auth() is available, but keep the whole site PUBLIC.
// A guest's first AI preview needs no login; further attempts require a
// signed-in user — enforced in /api/generate, not here.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
