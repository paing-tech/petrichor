"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { UserAvatar } from "@/components/account/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchRecipients } from "@/app/create/actions";
import type { PublicProfile } from "@/lib/profiles";

type RecipientPickerProps = {
  /** Up to one recipient per copy. */
  max: number;
  value: PublicProfile[];
  onChange: (value: PublicProfile[]) => void;
};

/**
 * Send copies straight to accounts, found by name or @username (they accept before it's
 * theirs), up to `max` people.
 */
export function RecipientPicker({ max, value, onChange }: RecipientPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef("");

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function handleInput(next: string) {
    setQuery(next);
    window.clearTimeout(timer.current);
    const term = next.trim();
    latest.current = term;
    if (term.replace(/^@/, "").length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = window.setTimeout(async () => {
      const found = await searchRecipients(term);
      if (latest.current !== term) return; // A newer search is on its way.
      setResults(found);
      setLoading(false);
    }, 250);
  }

  function add(profile: PublicProfile) {
    if (value.length >= max || value.some((p) => p.userId === profile.userId)) return;
    onChange([...value, profile]);
    setQuery("");
    setResults([]);
  }

  const full = value.length >= max;
  return (
    <div className="grid grid-cols-1 gap-2">
      <Label htmlFor="recipient-search">People</Label>

      {value.length > 0 && (
        <ul className="grid gap-1.5">
          {value.map((profile) => (
            <li key={profile.userId} className="bg-background flex items-center gap-3 rounded-lg border px-2.5 py-1.5">
              <UserAvatar displayName={profile.displayName} avatarUrl={profile.avatarUrl} className="size-6" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {profile.displayName} <span className="text-muted-foreground">@{profile.username}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${profile.displayName}`}
                onClick={() => onChange(value.filter((p) => p.userId !== profile.userId))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="recipient-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search by name or @username"
            className="bg-background h-10 pl-9"
          />
          {loading && (
            <Loader2Icon className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
          )}
          {query.trim().replace(/^@/, "").length >= 2 && !loading && (
            <ul className="bg-popover absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border py-1 shadow-lg">
              {results.length === 0 ? (
                <li className="text-muted-foreground px-3 py-2.5 text-sm">No accounts found. You can send them a link instead.</li>
              ) : (
                results.map((profile) => (
                  <li key={profile.userId}>
                    <button
                      type="button"
                      onClick={() => add(profile)}
                      disabled={value.some((p) => p.userId === profile.userId)}
                      className="hover:bg-muted flex w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-50"
                    >
                      <UserAvatar displayName={profile.displayName} avatarUrl={profile.avatarUrl} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{profile.displayName}</span>
                        <span className="text-muted-foreground block truncate text-xs">@{profile.username}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
