import { AccountMenuClient } from "@/components/account/account-menu-client";
import { getAccount } from "@/lib/auth/account";

/** Header account menu for signed-in visitors. Reads the session, so it renders per request inside <Suspense>. */
export async function AccountMenu() {
  const account = await getAccount();
  if (!account) return null;
  return (
    <AccountMenuClient
      displayName={account.profile?.displayName ?? account.user.name ?? account.user.email}
      username={account.profile?.username ?? null}
      avatarUrl={account.profile?.avatarUrl ?? account.user.image}
    />
  );
}
