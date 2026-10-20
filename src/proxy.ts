import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

/** Neon Auth's session cookie; present whenever someone is signed in. */
const SESSION_COOKIE = "__Secure-neon-auth.session_token";

/**
 * Two jobs:
 *
 * - On "/", signed-in visitors see their collections (the signed-in home page) instead of
 *   the welcome page. This only looks for the session cookie; the collections page checks
 *   the session itself, and sends anyone whose session has lapsed to "/?next=…", which
 *   always shows the welcome page with its sign-in form.
 * - Neon Auth's middleware finishes OAuth sign-in: when Google redirects back with a
 *   session verifier, it exchanges it for session cookies. It runs only on the OAuth
 *   landing page; account pages check the session themselves so they can send people back
 *   to where they were after signing in.
 */
export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const signedIn = request.cookies.has(SESSION_COOKIE);
    if (signedIn && !request.nextUrl.searchParams.has("next")) {
      return NextResponse.rewrite(new URL("/collections", request.url));
    }
    return NextResponse.next();
  }
  return getAuth().middleware({ loginUrl: "/" })(request);
}

export const config = {
  matcher: ["/", "/auth/callback"],
};
