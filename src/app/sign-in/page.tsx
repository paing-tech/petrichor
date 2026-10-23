import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/account/sign-in-form";
import { SignInLogo } from "@/components/account/sign-in-logo";
import { HideWordmark } from "@/components/hide-wordmark";
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
      {/* The icon above the title stands in for the header's wordmark (and links home too). */}
      <HideWordmark />
      <div className="flex w-full max-w-xs flex-col items-center gap-4">
        {/* Starts large in the middle of the screen, then shrinks up into place. */}
        <SignInLogo />
        {/* While the session is checked, an invisible copy of the title and form holds their
            place, so the logo's place doesn't move when they arrive. */}
        <Suspense fallback={<SignInContent next="/" placeholder />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * The title and the form: hidden until the logo has landed (SIGN_IN_READY), then fading in.
 * As a placeholder, invisible and inert.
 */
function SignInContent({ next, placeholder = false }: { next: string; placeholder?: boolean }) {
  return (
    <div
      className={
        placeholder
          ? "invisible flex w-full flex-col gap-6"
          : "pointer-events-none flex w-full flex-col gap-6 opacity-0 transition-opacity duration-250 [html[data-sign-in-ready]_&]:pointer-events-auto [html[data-sign-in-ready]_&]:opacity-100"
      }
      aria-hidden={placeholder || undefined}
      inert={placeholder}
    >
      <h1 className="text-center font-serif text-4xl tracking-tight">Sign in</h1>
      <SignInForm next={next} />
    </div>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const [account, params] = await Promise.all([getAccount(), searchParams]);
  const next = safeNextPath(params.next);
  if (account) redirect(afterSignInPath(account.profile, next));
  return <SignInContent next={next} />;
}
