import { Suspense } from "react";
import Link from "next/link";
import { SignInForm } from "@/components/account/sign-in-form";
import { CollectibleCard } from "@/components/collectible-card";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/auth/account";

const SAMPLE_CARD = {
  songTitle: "Here Comes the Sun",
  artistName: "The Beatles",
  lyricsExcerpt: "Little darling, it's been a long, cold, lonely winter",
  message: "For the first warm morning after all that rain.",
  senderName: "Mai",
  moment: "Singapore",
  createdAt: "2026-10-10",
  cardId: "P-1F8K2QZ7M4XW9C3T6RBNJD5HVA",
};

export default function Home() {
  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-4 pt-6 pb-20 sm:px-6 lg:grid-cols-2 lg:gap-20">
      <div className="mx-auto flex w-full max-w-85 flex-col gap-6 sm:max-w-100">
        <CollectibleCard card={SAMPLE_CARD} className="max-w-none" />
        <Button asChild size="lg" className="h-11">
          <Link href="/create">Create a keepsake</Link>
        </Button>
      </div>
      <div className="mx-auto w-full max-w-sm">
        {/* The session is read per request; keep the space while it loads. */}
        <Suspense fallback={<div className="h-72" />}>
          <AccountPanel />
        </Suspense>
      </div>
    </div>
  );
}

/** Sign in for visitors; a way to the collection for anyone already signed in. */
async function AccountPanel() {
  const account = await getAccount();

  if (account) {
    return (
      <div className="grid gap-6 text-center">
        <h2 className="font-serif text-4xl tracking-tight">
          {account.profile ? `Welcome back, ${account.profile.displayName}` : "Welcome back"}
        </h2>
        <Button asChild size="lg" variant="outline" className="bg-background h-11">
          <Link href={account.profile ? "/keepsakes" : "/onboarding?next=/keepsakes"}>Go to my keepsakes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <h2 className="text-center font-serif text-4xl tracking-tight">Sign in</h2>
      <SignInForm next="/keepsakes" />
    </div>
  );
}
