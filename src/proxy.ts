import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

/**
 * Neon Auth's middleware finishes OAuth sign-in: when Google redirects back with a session
 * verifier, it exchanges it for session cookies. It runs only on the OAuth landing page;
 * account pages check the session themselves so they can send people back to where they were
 * after signing in.
 */
export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: "/sign-in" })(request);
}

export const config = {
  matcher: ["/auth/callback"],
};
