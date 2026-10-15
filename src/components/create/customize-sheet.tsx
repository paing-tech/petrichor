"use client";

import { CollectibleCard, type CollectibleCardData } from "@/components/collectible-card";
import { ColorField, type ColorSwatch } from "@/components/create/color-field";
import { PhotoFramingLayer, PhotoZoomControls } from "@/components/create/photo-cropper";
import { PhotoField } from "@/components/create/photo-field";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EARTH_PHOTO_AREA, EARTH_PHOTO_AREA_TONE, PRESET_CARD_COLORS } from "@/lib/card-color";
import type { PhotoView } from "@/lib/photo-crop";

const WHITE = PRESET_CARD_COLORS.find((c) => c.name === "White")!;

const PHOTO_AREA_SWATCHES: ColorSwatch[] = [
  { label: "White", value: WHITE.value },
  { label: "Earthy (default)", value: null, background: EARTH_PHOTO_AREA, checkBackground: EARTH_PHOTO_AREA_TONE },
];

type CustomizeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The live preview card; its photo area becomes the framing surface. */
  card: CollectibleCardData;
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

/** Slide-up panel for the card's look: photo (framed on the card itself) and colors. */
export function CustomizeSheet({
  open,
  onOpenChange,
  card,
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
}: CustomizeSheetProps) {
  const framing = photo && {
    imageWidth: photo.width,
    imageHeight: photo.height,
    view: photo.view,
    onChange: onPhotoViewChange,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl duration-300">
        <div className="mx-auto grid w-full max-w-md gap-6 px-5 pt-3 pb-8">
          <div aria-hidden className="bg-muted mx-auto h-1.5 w-10 rounded-full" />
          <SheetHeader className="p-0">
            <SheetTitle className="font-serif text-2xl font-normal">Customize</SheetTitle>
            <SheetDescription className="sr-only">Add and frame a photo, and choose the card&apos;s colors.</SheetDescription>
          </SheetHeader>

          <div className="grid gap-3">
            <CollectibleCard
              card={card}
              className="mx-auto max-w-[230px] sm:max-w-[300px]"
              photoOverlay={framing ? <PhotoFramingLayer {...framing} /> : undefined}
            />
            {framing && <PhotoZoomControls {...framing} />}
          </div>

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

          <SheetClose asChild>
            <Button size="lg" className="h-11 rounded-full">
              Done
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
