"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOutIcon, SettingsIcon, SparklesIcon } from "lucide-react";
import { UserAvatar } from "@/components/account/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";

type AccountMenuClientProps = {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

export function AccountMenuClient({ displayName, username, avatarUrl }: AccountMenuClientProps) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-3"
        aria-label="Account menu"
      >
        <UserAvatar displayName={displayName} avatarUrl={avatarUrl} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {username && <p className="text-muted-foreground truncate text-xs">@{username}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/keepsakes">
            <SparklesIcon /> My keepsakes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
