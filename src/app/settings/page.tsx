import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/account/settings-form";
import { getAccount } from "@/lib/auth/account";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-6 pb-16">
      <h1 className="font-serif text-4xl tracking-tight">Settings</h1>
      <Suspense>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const account = await getAccount();
  if (!account) redirect("/sign-in?next=/settings");
  if (!account.profile) redirect("/onboarding?next=/settings");
  const { profile } = account;
  return (
    <>
      <SettingsForm username={profile.username} displayName={profile.displayName} searchable={profile.searchable} />
      <p className="text-muted-foreground text-xs">Signed in as {account.user.email}</p>
    </>
  );
}
