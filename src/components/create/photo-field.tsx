"use client";

import { useRef, type ReactNode } from "react";
import { ImagePlusIcon, XIcon } from "lucide-react";
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

export function PhotoField({ previewUrl, fileName, error, disabled, onSelect, onRemove, children }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-2">
      <Label htmlFor="photo">
        Photo <span className="text-muted-foreground font-normal">(optional)</span>
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
        <div className="bg-background flex items-center gap-3 rounded-lg border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" className="size-14 rounded-md object-cover" />
          <span className="min-w-0 flex-1 truncate text-sm">{fileName}</span>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
            Replace
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={onRemove} aria-label="Remove photo">
            <XIcon />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          data-invalid={!!error || undefined}
          className="border-input text-muted-foreground hover:border-ring hover:text-foreground focus-visible:ring-ring/50 data-invalid:border-destructive flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-transparent text-sm transition-colors outline-none focus-visible:ring-3"
        >
          <ImagePlusIcon className="size-5" />
          Add a photo
        </button>
      )}
      <p id="photo-hint" className={error ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
        {error ?? "Any photo. Frame it below; it's saved in high quality."}
      </p>
      {children}
    </div>
  );
}
