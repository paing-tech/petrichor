"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ColorField, type ColorSwatch } from "@/components/create/color-field";
import { PhotoZoomControls } from "@/components/create/photo-cropper";
import { PhotoField } from "@/components/create/photo-field";
import { Button } from "@/components/ui/button";
import { EARTH_PHOTO_AREA, EARTH_PHOTO_AREA_TONE, PRESET_CARD_COLORS } from "@/lib/card-color";
import type { PhotoView } from "@/lib/photo-crop";
import { cn } from "@/lib/utils";

const WHITE = PRESET_CARD_COLORS.find((c) => c.name === "White")!;

const PHOTO_AREA_SWATCHES: ColorSwatch[] = [
  { label: "White", value: WHITE.value },
  { label: "Earthy (default)", value: null, background: EARTH_PHOTO_AREA, checkBackground: EARTH_PHOTO_AREA_TONE },
];

/** Gap between the bottom of the card and the top of the panel. */
const GAP = 12;
/** Below this width the panel spans the screen; above it, it sits under the preview column. */
const WIDE_QUERY = "(min-width: 1024px)";

type CustomizePanelProps = {
  open: boolean;
  onClose: () => void;
  /** The live preview card; the panel sits just below it, and it stays usable for framing. */
  anchorRef: RefObject<HTMLElement | null>;
  photo: { previewUrl: string; fileName: string; width: number; height: number; view: PhotoView } | null;
  photoError?: string;
  onPhotoSelect: (file: File) => void;
  onPhotoRemove: () => void;
  onPhotoViewChange: (view: PhotoView) => void;
  photoColors: string[];
  photoAreaColor: string | null;
  onPhotoAreaColorChange: (color: string | null) => void;
  cardColor: string;
  onCardColorChange: (color: string) => void;
};

/**
 * Slide-up panel for the card's look (photo and colors). It fills the space below
 * the live preview rather than covering it, so the photo is framed on the card itself.
 */
export function CustomizePanel({
  open,
  onClose,
  anchorRef,
  photo,
  photoError,
  onPhotoSelect,
  onPhotoRemove,
  onPhotoViewChange,
  photoColors,
  photoAreaColor,
  onPhotoAreaColorChange,
  cardColor,
  onCardColorChange,
}: CustomizePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<CSSProperties>({ top: "45%" });

  // Keep the panel's top edge just under the card (it moves while the page scrolls the card into view).
  useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const wide = window.matchMedia(WIDE_QUERY).matches;
      setPlacement({
        // Never let the panel shrink to nothing on short screens.
        top: Math.min(rect.bottom + GAP, window.innerHeight - 240),
        ...(wide ? { left: rect.left, width: rect.width } : { left: 0, right: 0 }),
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [open, anchorRef]);

  // Focus moves into the panel once, when it opens.
  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Escape closes. The latest onClose is read through a ref so re-renders
  // (e.g. while dragging the photo) don't re-register the listener.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const framing = photo && {
    imageWidth: photo.width,
    imageHeight: photo.height,
    view: photo.view,
    onChange: onPhotoViewChange,
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="customize-title"
      tabIndex={-1}
      inert={!open}
      style={placement}
      className={cn(
        "bg-popover text-popover-foreground fixed bottom-0 z-40 flex flex-col rounded-t-3xl border-t shadow-[0_-12px_40px_-12px_rgba(40,30,20,0.25)] outline-none lg:border-x",
        "transition-transform duration-300 ease-out",
        open ? "translate-y-0" : "pointer-events-none translate-y-[110%]",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h2 id="customize-title" className="font-serif text-2xl">
          Customize
        </h2>
        <Button type="button" size="sm" className="rounded-full px-4" onClick={onClose}>
          Done
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto overscroll-contain px-5 pt-2 pb-8">
        {framing && (
          <div className="grid gap-1">
            <p className="text-muted-foreground text-xs">Drag or pinch the photo on the card to frame it.</p>
            <PhotoZoomControls {...framing} />
          </div>
        )}

        <PhotoField
          previewUrl={photo?.previewUrl ?? null}
          fileName={photo?.fileName ?? null}
          error={photoError}
          onSelect={onPhotoSelect}
          onRemove={onPhotoRemove}
        />

        <section className="grid gap-4">
          <h3 className="text-sm font-medium">Color palette</h3>
          {/* The photo area's own fill only shows when there's no photo. */}
          {!photo && (
            <ColorField
              id="photo-area-color"
              label="Top"
              value={photoAreaColor}
              swatches={PHOTO_AREA_SWATCHES}
              customFallback={EARTH_PHOTO_AREA_TONE}
              onChange={onPhotoAreaColorChange}
            />
          )}
          <ColorField
            id="card-color"
            label={photo ? "Card · includes colors from your photo" : "Card"}
            value={cardColor}
            swatches={[
              ...PRESET_CARD_COLORS.map((c) => ({ label: c.name, value: c.value })),
              ...photoColors.map((color, i) => ({ label: `Photo color ${i + 1}`, value: color, gapBefore: i === 0 })),
            ]}
            customFallback={cardColor}
            onChange={(color) => color && onCardColorChange(color)}
          />
        </section>
      </div>
    </div>
  );
}
