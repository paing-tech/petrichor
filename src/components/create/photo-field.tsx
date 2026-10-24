"use client";

import { useRef, type ReactNode } from "react";
import { ImagePlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type PhotoFieldProps = {
  previewUrl: string | null;
  fileName: string | null;
  error?: string;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  /** Shown under the selected photo, e.g. the crop editor. */
  children?: ReactNode;
};

/**
 * The photo, kept quiet: one "Add photo" button, and once there's a photo (shown and framed on
 * the preview card above), just "Change photo" and "Remove" with its zoom.
 */
export function PhotoField({ previewUrl, error, disabled, onSelect, onRemove, children }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();

  return (
    <div className="grid grid-cols-1 gap-3">
      {/* The buttons say what this is; the label stays for screen readers. */}
      <Label htmlFor="photo" className="sr-only">
        Photo
      </Label>
      <input
        ref={inputRef}
        id="photo"
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby="photo-hint"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          // Reset so picking the same file again still fires a change.
          e.target.value = "";
        }}
      />
      {previewUrl ? (
        <>
          <div className="flex items-center gap-4 text-sm">
            <button type="button" disabled={disabled} onClick={pick} className="hover:text-foreground font-medium underline-offset-4 hover:underline">
              Change photo
            </button>
            <button type="button" disabled={disabled} onClick={onRemove} className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
              Remove
            </button>
          </div>
          {children}
          {/* The card itself says how to frame it ("Drag to reposition"); only errors show here. */}
          {error && (
            <p id="photo-hint" className="text-destructive text-xs">
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <Button type="button" variant="outline" size="lg" className="bg-background w-full" disabled={disabled} onClick={pick} aria-invalid={!!error || undefined}>
            <ImagePlusIcon /> Add photo
          </Button>
          {error && (
            <p id="photo-hint" className="text-destructive text-xs">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
