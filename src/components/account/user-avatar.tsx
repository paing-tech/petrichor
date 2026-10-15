import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  displayName: string;
  avatarUrl?: string | null;
  className?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "?";
}

/** Profile photo with an initials fallback (accounts made with an email code have no photo). */
export function UserAvatar({ displayName, avatarUrl, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("size-8", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="bg-clay/15 text-clay text-xs font-medium">{initials(displayName)}</AvatarFallback>
    </Avatar>
  );
}
