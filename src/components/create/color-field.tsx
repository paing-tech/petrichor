"use client";

import { CheckIcon } from "lucide-react";
import { cardInk } from "@/lib/card-color";
import { cn } from "@/lib/utils";

export type ColorSwatch = {
  label: string;
  /** A #rrggbb color, or null for a non-color default such as a gradient. */
  value: string | null;
  /** CSS background for the swatch; defaults to `value`. */
  background?: string;
  /** Color the swatch's check mark is drawn against; defaults to `value`. */
  checkBackground?: string;
  /** Adds space before this swatch to separate groups. */
  gapBefore?: boolean;
};

type ColorFieldProps = {
  id: string;
  label: string;
  value: string | null;
  swatches: ColorSwatch[];
  hint?: string;
  /** What the custom picker opens on while a preset is selected. */
  customFallback: string;
  onChange: (value: string | null) => void;
};

export function ColorField({ id, label, value, swatches, hint, customFallback, onChange }: ColorFieldProps) {
  const labelId = `${id}-label`;
  const isCustom = value !== null && !swatches.some((s) => s.value === value);

  return (
    <div className="grid gap-2">
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap items-center gap-2.5">
        {swatches.map((swatch) => (
          <Swatch
            key={swatch.value ?? "default"}
            swatch={swatch}
            selected={swatch.value === value}
            onSelect={() => onChange(swatch.value)}
          />
        ))}

        {/* The native color input opens the system picker; the swatch shows the
            current custom color once one is chosen. */}
        <label
          className={cn(
            "focus-within:ring-ring/50 relative ml-2 grid size-9 cursor-pointer place-items-center rounded-full ring-offset-2 transition-shadow focus-within:ring-3",
            isCustom && "ring-foreground ring-2",
          )}
          style={{
            background: isCustom
              ? value
              : "conic-gradient(from 0deg, #ff5f6d, #ffc371, #f9f871, #6ee7b7, #60a5fa, #a78bfa, #f472b6, #ff5f6d)",
          }}
          title="Custom color"
        >
          <input
            type="color"
            role="radio"
            aria-checked={isCustom}
            aria-label="Custom color"
            value={isCustom ? value : customFallback}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          {isCustom && <CheckIcon className="pointer-events-none size-4" style={{ color: cardInk(value).ink }} />}
        </label>
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function Swatch({ swatch, selected, onSelect }: { swatch: ColorSwatch; selected: boolean; onSelect: () => void }) {
  const checkBackground = swatch.checkBackground ?? swatch.value ?? "#ffffff";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={swatch.label}
      title={swatch.label}
      onClick={onSelect}
      className={cn(
        "focus-visible:ring-ring/50 grid size-9 place-items-center rounded-full border border-black/10 ring-offset-2 transition-shadow outline-none focus-visible:ring-3",
        selected && "ring-foreground ring-2",
        swatch.gapBefore && "ml-2",
      )}
      style={{ background: swatch.background ?? swatch.value ?? undefined }}
    >
      {selected && <CheckIcon className="size-4" style={{ color: cardInk(checkBackground).ink }} />}
    </button>
  );
}
