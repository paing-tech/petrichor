"use client";

import { ColorField, type ColorSwatch } from "@/components/create/color-field";
import { PhotoZoomControls } from "@/components/create/photo-cropper";
import { PhotoField } from "@/components/create/photo-field";
import { EARTH_PHOTO_AREA, EARTH_PHOTO_AREA_TONE, PRESET_CARD_COLORS } from "@/lib/card-color";
import type { PhotoView } from "@/lib/photo-crop";

const WHITE = PRESET_CARD_COLORS.find((c) => c.name === "White")!;

const PHOTO_AREA_SWATCHES: ColorSwatch[] = [
  { label: "White", value: WHITE.value },
  { label: "Earthy (default)", value: null, background: EARTH_PHOTO_AREA, checkBackground: EARTH_PHOTO_AREA_TONE },
];

type PhotoAndColorsProps = {
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
 * The card's look: a photo (framed by dragging it on the preview card itself)
 * and the color palette for the photo area and the card.
 */
export function PhotoAndColors({
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
}: PhotoAndColorsProps) {
  return (
    <>
      <PhotoField
        previewUrl={photo?.previewUrl ?? null}
        fileName={photo?.fileName ?? null}
        error={photoError}
        onSelect={onPhotoSelect}
        onRemove={onPhotoRemove}
      >
        {photo && (
          <PhotoZoomControls
            imageWidth={photo.width}
            imageHeight={photo.height}
            view={photo.view}
            onChange={onPhotoViewChange}
          />
        )}
      </PhotoField>

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
    </>
  );
}
