import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/account/sign-in-form";
import { afterSignInPath, getAccount, safeNextPath } from "@/lib/auth/account";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/**
 * Sign in, in the middle of the screen: email code or Google. Pages that need an account send
 * visitors here with `next`, where they return afterwards (see signInPath); anyone already
 * signed in goes straight there.
 */
export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
      <div className="flex w-full max-w-xs flex-col gap-8">
        <div className="text-center">
          <h1 className="font-serif text-4xl tracking-tight">Sign in</h1>
        </div>
        <Suspense>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const [account, params] = await Promise.all([getAccount(), searchParams]);
  const next = safeNextPath(params.next);
  if (account) redirect(afterSignInPath(account.profile, next));
  return <SignInForm next={next} />;
}
