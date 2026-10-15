import "server-only";
import { cookies } from "next/headers";
import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";
import { getAuthEnv } from "@/lib/env";

let auth: NeonAuth | undefined;

/** Neon Auth (Managed Better Auth), created on first use so builds work without secrets. */
export function getAuth() {
  if (!auth) {
    const env = getAuthEnv();
    auth = createNeonAuth({
      baseUrl: env.NEON_AUTH_BASE_URL,
      cookies: { secret: env.NEON_AUTH_COOKIE_SECRET },
    });
  }
  return auth;
}

export type SessionUser = { id: string; name: string; email: string; image: string | null };

/**
 * The signed-in user, or null. Reads cookies, so callers render per request
 * (inside <Suspense> under Cache Components).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  // Touch request cookies first so prerendering defers here cleanly, instead of the
  // SDK's own cookie read failing (and logging) during the static build.
  await cookies();
  const { data } = await getAuth().getSession();
  const user = data?.user;
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, image: user.image ?? null };
}
