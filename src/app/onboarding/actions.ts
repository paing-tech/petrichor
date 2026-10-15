"use server";

import { redirect } from "next/navigation";
import { getAccount, safeNextPath } from "@/lib/auth/account";
import { createProfile } from "@/lib/profiles";
import { profileInputSchema } from "@/lib/validation";

export type ProfileFormState = {
  error?: string;
  fieldErrors?: { username?: string; displayName?: string };
};

/** Saves the new account's username and name, then continues to where they were going. */
export async function saveNewProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const account = await getAccount();
  if (!account) redirect("/sign-in");

  const next = safeNextPath(formData.get("next")?.toString());
  if (account.profile) redirect(next);

  const parsed = profileInputSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    const fieldErrors: ProfileFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "username" | "displayName";
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const result = await createProfile(account.user, parsed.data);
  if (!result.ok) return { fieldErrors: { username: result.error } };
  redirect(next);
}
