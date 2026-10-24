"use client";

import { ColorField } from "@/components/create/color-field";
import { PhotoField } from "@/components/create/photo-field";
import { PRESET_CARD_COLORS } from "@/lib/card-color";
import type { PhotoView } from "@/lib/photo-crop";

type PhotoAndColorsProps = {
  photo: { previewUrl: string; fileName: string; width: number; height: number; view: PhotoView } | null;
  photoError?: string;
  onPhotoSelect: (file: File) => void;
  onPhotoRemove: () => void;
  photoColors: string[];
  cardColor: string;
  onCardColorChange: (color: string) => void;
};

/**
 * The card's look: a photo (framed by dragging it on the preview card itself) and the card's
 * color, one color for the whole card (without a photo, its top is a tone of the same color).
 */
export function PhotoAndColors({
  photo,
  photoError,
  onPhotoSelect,
  onPhotoRemove,
  photoColors,
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
      />

      {/* One heading for the one choice; with a photo, its colors join the presets. */}
      <section className="grid gap-4">
        <ColorField
          id="card-color"
          label="Card color"
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
