import "server-only";
import { and, eq, ilike, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, type Profile } from "@/db/schema";
import { isUniqueViolation } from "@/lib/cards";
import type { SessionUser } from "@/lib/auth/server";

/** What anyone may see about an account: shown under owned cards and in search. */
export type PublicProfile = Pick<Profile, "userId" | "username" | "displayName" | "avatarUrl">;

const publicColumns = {
  userId: profiles.userId,
  username: profiles.username,
  displayName: profiles.displayName,
  avatarUrl: profiles.avatarUrl,
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return profile ?? null;
}

export async function isUsernameTaken(username: string, exceptUserId?: string) {
  const [row] = await getDb()
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(
      exceptUserId
        ? and(eq(profiles.username, username), ne(profiles.userId, exceptUserId))
        : eq(profiles.username, username),
    )
    .limit(1);
  return Boolean(row);
}

/** A starting suggestion for the username field, from the account's name or email. */
export function suggestUsername(user: SessionUser): string {
  const base = (user.name || user.email.split("@")[0])
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : `${base}${"000".slice(base.length)}`;
}

type SaveResult = { ok: true } | { ok: false; field: "username"; error: string };

export async function createProfile(
  user: SessionUser,
  input: { username: string; displayName: string },
): Promise<SaveResult> {
  try {
    await getDb()
      .insert(profiles)
      .values({ userId: user.id, ...input, avatarUrl: user.image })
      .onConflictDoNothing({ target: profiles.userId });
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, field: "username", error: "That username is taken" };
    throw error;
  }
}

export async function updateProfile(
  userId: string,
  input: { username: string; displayName: string; searchable: boolean },
): Promise<SaveResult> {
  try {
    await getDb()
      .update(profiles)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(profiles.userId, userId));
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, field: "username", error: "That username is taken" };
    throw error;
  }
}

/** Escapes LIKE wildcards so a search for "a_b" or "50%" matches literally. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Recipient search: searchable accounts whose username starts with, or display
 * name contains, the query. Only public fields are returned.
 */
export async function searchProfiles(query: string, excludeUserId: string | null): Promise<PublicProfile[]> {
  const term = query.trim().replace(/^@/, "");
  if (term.length < 2) return [];
  const pattern = escapeLike(term.toLowerCase());
  return getDb()
    .select(publicColumns)
    .from(profiles)
    .where(
      and(
        eq(profiles.searchable, true),
        excludeUserId ? ne(profiles.userId, excludeUserId) : undefined,
        or(ilike(profiles.username, `${pattern}%`), ilike(profiles.displayName, `%${pattern}%`)),
      ),
    )
    // Exact and prefix username matches first, then by name.
    .orderBy(sql`${profiles.username} <> ${term.toLowerCase()}`, sql`${profiles.username} not ilike ${`${pattern}%`}`, profiles.displayName)
    .limit(8);
}

/** Recipients must exist and be searchable; returns the ones that qualify. */
export async function getSearchableProfiles(userIds: string[]): Promise<PublicProfile[]> {
  if (userIds.length === 0) return [];
  return getDb()
    .select(publicColumns)
    .from(profiles)
    .where(and(eq(profiles.searchable, true), sql`${profiles.userId} in ${userIds}`));
}
