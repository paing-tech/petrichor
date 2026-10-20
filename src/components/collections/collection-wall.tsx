"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import {
  DraggableContainer,
  GridBody,
  GridItem,
} from "@/components/ui/infinite-drag-scroll";
import type { CollectionPhoto } from "@/lib/collections";
import { cn } from "@/lib/utils";

/** Fewer photos than this are repeated, so the endless wall never looks sparse. */
const MIN_TILES = 12;
/**
 * Tiles keep each photo's own shape, except extremes: anything taller than 1:2 or wider
 * than 2:1 (screenshots, panoramas) is trimmed to that on the wall. The full view shows
 * the whole photo.
 */
const MIN_TILE_RATIO = 1 / 2;
const MAX_TILE_RATIO = 2;
/** A press that moves further than this (px) is a drag, not a tap. */
const TAP_SLOP = 8;
/** After a drag or a scroll the wall keeps gliding this long (ms); a tap then only stops it. */
const GLIDE_MS = 700;

/**
 * A collection's photos on an endless wall you drag (or scroll) around. Tap a photo to see
 * the original, at full quality, in the middle of the screen.
 */
export function CollectionWall({ photos }: { photos: CollectionPhoto[] }) {
  const [open, setOpen] = useState<CollectionPhoto | null>(null);
  // Tells a tap from the end of a drag, or from a tap that stops the wall gliding.
  const press = useRef({ x: 0, y: 0, glidingUntil: 0, wasGliding: false });

  if (photos.length === 0) return null;
  const tiles = Array.from(
    { length: Math.max(photos.length, Math.ceil(MIN_TILES / photos.length) * photos.length) },
    (_, i) => ({ photo: photos[i % photos.length], key: `${photos[i % photos.length].id}-${i}` }),
  );

  return (
    <>
      <div
        onPointerDownCapture={(event) => {
          press.current.x = event.clientX;
          press.current.y = event.clientY;
          press.current.wasGliding = performance.now() < press.current.glidingUntil;
        }}
        onPointerUpCapture={(event) => {
          if (Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > TAP_SLOP) {
            press.current.glidingUntil = performance.now() + GLIDE_MS;
          }
        }}
        onWheelCapture={() => {
          press.current.glidingUntil = performance.now() + GLIDE_MS;
        }}
      >
        <DraggableContainer variant="masonry">
          <GridBody>
            {tiles.map(({ photo, key }) => {
              const ratio = Math.min(MAX_TILE_RATIO, Math.max(MIN_TILE_RATIO, photo.width / photo.height));
              return (
                <GridItem
                  key={key}
                  className="relative h-auto w-36 self-start md:w-64"
                  style={{ aspectRatio: ratio }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt=""
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    className="pointer-events-none absolute h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label="View photo"
                    className="absolute inset-0 cursor-pointer"
                    onClick={(event) => {
                      const moved =
                        Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > TAP_SLOP;
                      // Keyboard presses (no pointer position) always open.
                      const fromPointer = event.detail > 0;
                      if (fromPointer && (moved || press.current.wasGliding)) return;
                      setOpen(photo);
                    }}
                  />
                </GridItem>
              );
            })}
          </GridBody>
        </DraggableContainer>
      </div>
      {open && <PhotoViewer photo={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * One photo, whole and centred, over a dark backdrop. The preview (already loaded) shows at
 * once; the original replaces it as soon as it arrives.
 */
function PhotoViewer({ photo, onClose }: { photo: CollectionPhoto; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      onClick={onClose}
      // Keeps the wall behind from scrolling.
      onWheel={(event) => event.stopPropagation()}
      className="animate-in fade-in fixed inset-0 z-70 grid place-items-center bg-black/90 p-[max(1rem,env(safe-area-inset-top))] duration-200"
    >
      {/* Sized by the photo's own shape, as large as fits the screen. */}
      <div
        className="relative max-h-full max-w-full"
        // Tapping the photo keeps it open; tapping around it closes.
        onClick={(event) => event.stopPropagation()}
        style={{
          aspectRatio: `${photo.width} / ${photo.height}`,
          width: `min(100%, (100dvh - 2rem) * ${photo.width / photo.height})`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.previewUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.originalUrl}
          alt=""
          onLoad={() => setLoaded(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-contain transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
        {!loaded && (
          <span className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80 backdrop-blur">
            <LoaderCircleIcon className="size-3 animate-spin" /> Loading original
          </span>
        )}
      </div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
