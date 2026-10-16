import { Suspense } from "react";
import type { Metadata } from "next";
import { SignInForm } from "@/components/account/sign-in-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 pt-10 pb-16">
      <h1 className="text-center font-serif text-4xl tracking-tight">Sign in</h1>
      <Suspense>
        <SignInFormWithNext searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SignInFormWithNext({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const { next } = await searchParams;
  const value = Array.isArray(next) ? next[0] : next;
  // Only same-site paths; anything else falls back to the collection.
  const safe = value && value.startsWith("/") && !value.startsWith("//") ? value : "/keepsakes";
  return <SignInForm next={safe} />;
}
