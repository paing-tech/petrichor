import { AccountMenuClient, SignInLink } from "@/components/account/account-menu-client";
import { getAccount } from "@/lib/auth/account";

/** Header account area. Reads the session, so it renders per request inside <Suspense>. */
export async function AccountMenu() {
  const account = await getAccount();
  if (!account) return <SignInLink />;
  return (
    <AccountMenuClient
      displayName={account.profile?.displayName ?? account.user.name ?? account.user.email}
      username={account.profile?.username ?? null}
      avatarUrl={account.profile?.avatarUrl ?? account.user.image}
    />
  );
}
