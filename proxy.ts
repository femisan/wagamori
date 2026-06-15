import { clerkMiddleware } from "@clerk/nextjs/server";

// Enable Clerk so auth() is available, but keep the whole site PUBLIC.
// The free AI preview needs no login; only the conversational edit endpoint
// (/api/edit) requires a signed-in user — enforced in that route, not here.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
