import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/account/onboarding-form";
import { getAccount, safeNextPath } from "@/lib/auth/account";
import { suggestUsername } from "@/lib/profiles";

export const metadata: Metadata = { title: "Set up your account", robots: { index: false } };

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 pt-10 pb-16">
      <div className="text-center">
        <h1 className="font-serif text-4xl tracking-tight">Choose your name</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          This is how you appear under the cards you own.
        </p>
      </div>
      <Suspense>
        <Setup searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Setup({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=${encodeURIComponent(`/onboarding?next=${next}`)}`);
  if (account.profile) redirect(next);

  // Email-code accounts have no name yet; Neon Auth stores the email there or leaves it blank.
  const name = account.user.name && account.user.name !== account.user.email ? account.user.name : "";
  return <OnboardingForm next={next} suggestedUsername={suggestUsername(account.user)} suggestedName={name} />;
}
