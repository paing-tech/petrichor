import "server-only";
import { getSessionUser, type SessionUser } from "@/lib/auth/server";
import { getProfile } from "@/lib/profiles";
import type { Profile } from "@/db/schema";

export type Account = { user: SessionUser; profile: Profile | null };

/** The signed-in user and their profile (null until they finish choosing a username). */
export async function getAccount(): Promise<Account | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return { user, profile: await getProfile(user.id) };
}

/** Where to send someone after signing in: back to `next`, via username setup if needed. */
export function afterSignInPath(profile: Profile | null, next: string) {
  return profile ? next : `/onboarding?next=${encodeURIComponent(next)}`;
}

/** Only same-site paths are allowed as post-sign-in destinations. */
export function safeNextPath(value: string | string[] | undefined, fallback = "/") {
  const next = Array.isArray(value) ? value[0] : value;
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
