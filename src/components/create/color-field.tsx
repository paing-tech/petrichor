"use client";

import { CheckIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cardInk, PRESET_CARD_COLORS } from "@/lib/card-color";
import { cn } from "@/lib/utils";

type ColorFieldProps = {
  value: string;
  /** Colors extracted from the attached photo, if any. */
  photoColors: string[];
  onChange: (color: string) => void;
};

export function ColorField({ value, photoColors, onChange }: ColorFieldProps) {
  const swatches = [
    ...PRESET_CARD_COLORS.map((c) => ({ label: c.name, value: c.value })),
    ...photoColors.map((color, i) => ({ label: `Photo color ${i + 1}`, value: color })),
  ];
  const isCustom = !swatches.some((s) => s.value === value);

  return (
    <div className="grid gap-2">
      <Label id="card-color-label">Card color</Label>
      <div role="radiogroup" aria-labelledby="card-color-label" className="flex flex-wrap items-center gap-2.5">
        {swatches.map((swatch, i) => (
          <Swatch
            key={swatch.value}
            label={swatch.label}
            color={swatch.value}
            selected={swatch.value === value}
            // A visual gap between the presets and the photo colors.
            className={i === PRESET_CARD_COLORS.length ? "ml-2" : undefined}
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
            value={value}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          {isCustom && <CheckIcon className="pointer-events-none size-4" style={{ color: cardInk(value).ink }} />}
        </label>
      </div>
      <p className="text-muted-foreground text-xs">
        {photoColors.length > 0
          ? "White, black, colors from your photo, or pick your own."
          : "Add a photo to get colors picked from it."}
      </p>
    </div>
  );
}

type SwatchProps = {
  label: string;
  color: string;
  selected: boolean;
  className?: string;
  onSelect: () => void;
};

function Swatch({ label, color, selected, className, onSelect }: SwatchProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={cn(
        "focus-visible:ring-ring/50 grid size-9 place-items-center rounded-full border border-black/10 ring-offset-2 transition-shadow outline-none focus-visible:ring-3",
        selected && "ring-foreground ring-2",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {selected && <CheckIcon className="size-4" style={{ color: cardInk(color).ink }} />}
    </button>
  );
}
