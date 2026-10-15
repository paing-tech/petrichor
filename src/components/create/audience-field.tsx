"use client";

import { UserIcon, UsersIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type Audience = "self" | "others";

const OPTIONS: { value: Audience; label: string; icon: typeof UserIcon }[] = [
  { value: "self", label: "For myself", icon: UserIcon },
  { value: "others", label: "For someone", icon: UsersIcon },
];

export function AudienceField({ value, onChange }: { value: Audience; onChange: (value: Audience) => void }) {
  return (
    <div className="grid gap-2">
      <Label id="audience-label">Who is this card for?</Label>
      <div role="radiogroup" aria-labelledby="audience-label" className="grid grid-cols-2 gap-2">
        {OPTIONS.map(({ value: option, label, icon: Icon }) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "bg-background focus-visible:ring-ring/50 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3",
              value === option ? "border-foreground ring-foreground ring-1" : "hover:border-foreground/40",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Icon className="size-4" /> {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
