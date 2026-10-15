import { Suspense } from "react";
import { redirect } from "next/navigation";
import { afterSignInPath, getAccount, safeNextPath } from "@/lib/auth/account";

/**
 * Every sign-in lands here (Google via Neon Auth's middleware, which turns the OAuth
 * verifier into a session first). New accounts go to username setup, others onward.
 */
export default function AuthCallbackPage({ searchParams }: PageProps<"/auth/callback">) {
  return (
    <div className="text-muted-foreground px-4 py-24 text-center text-sm">
      <Suspense fallback="Signing you in…">
        <Continue searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Continue({ searchParams }: Pick<PageProps<"/auth/callback">, "searchParams">): Promise<null> {
  const next = safeNextPath((await searchParams).next);
  const account = await getAccount();
  if (!account) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  redirect(afterSignInPath(account.profile, next));
}
