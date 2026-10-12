"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { largeEditionMailto } from "@/lib/contact";
import { MAX_EDITION_SIZE } from "@/lib/validation";

type EditionFieldProps = {
  /** Raw input text, so the field can be cleared while typing. */
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export function EditionField({ value, error, onChange }: EditionFieldProps) {
  const current = Number.parseInt(value, 10);
  const step = (delta: number) => {
    const base = Number.isFinite(current) ? current : 1;
    onChange(String(Math.min(MAX_EDITION_SIZE, Math.max(1, base + delta))));
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor="editionSize">Copies</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Fewer copies"
          disabled={Number.isFinite(current) && current <= 1}
          onClick={() => step(-1)}
        >
          <MinusIcon />
        </Button>
        <Input
          id="editionSize"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_EDITION_SIZE}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="editionSize-hint"
          className="bg-background h-9 w-20 text-center tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="More copies"
          disabled={Number.isFinite(current) && current >= MAX_EDITION_SIZE}
          onClick={() => step(1)}
        >
          <PlusIcon />
        </Button>
      </div>
      <p id="editionSize-hint" className={error ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
        {error ??
          `Make up to ${MAX_EDITION_SIZE} numbered copies of this card (1 of 3, 2 of 3, …). Each copy gets its own card ID and link.`}{" "}
        <ContactForMore />
      </p>
    </div>
  );
}

function ContactForMore() {
  const href = largeEditionMailto();
  const text = `Need more than ${MAX_EDITION_SIZE}?`;
  if (!href) return <>{text} Contact us.</>;
  return (
    <>
      {text}{" "}
      <a href={href} className="text-foreground underline underline-offset-2">
        Contact us
      </a>
      .
    </>
  );
}

/** Parses the field's text; returns an error message when it isn't a valid edition size. */
export function parseEditionSize(value: string): { size: number; error?: undefined } | { size?: undefined; error: string } {
  const size = Number(value);
  if (!value.trim() || !Number.isInteger(size)) return { error: "Enter a whole number of copies." };
  if (size < 1) return { error: "Make at least 1 copy." };
  if (size > MAX_EDITION_SIZE) return { error: `You can make up to ${MAX_EDITION_SIZE} copies here.` };
  return { size };
}
