"use server";

import { getAccount } from "@/lib/auth/account";
import { updateProfile } from "@/lib/profiles";
import { profileInputSchema } from "@/lib/validation";
import type { ProfileFormState } from "@/app/onboarding/actions";

export type SettingsFormState = ProfileFormState & { saved?: boolean };

export async function saveSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const account = await getAccount();
  if (!account?.profile) return { error: "Sign in again to change your settings." };

  const parsed = profileInputSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    const fieldErrors: SettingsFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "username" | "displayName";
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const result = await updateProfile(account.user.id, {
    ...parsed.data,
    searchable: formData.get("searchable") === "on",
  });
  if (!result.ok) return { fieldErrors: { username: result.error } };
  return { saved: true };
}
