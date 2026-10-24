"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { MinusIcon, MoveIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cropFromView,
  DEFAULT_PHOTO_VIEW,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeView,
  type PhotoView,
} from "@/lib/photo-crop";
import { cn } from "@/lib/utils";

const ZOOM_STEP = 0.25;
/** Arrow keys move the photo by this fraction of the visible area. */
const KEY_PAN_STEP = 0.05;

type FramingProps = {
  imageWidth: number;
  imageHeight: number;
  view: PhotoView;
  onChange: (view: PhotoView) => void;
};

function useFraming({ imageWidth, imageHeight, view, onChange }: FramingProps) {
  const crop = cropFromView(imageWidth, imageHeight, view);
  const update = (next: PhotoView) => onChange(normalizeView(imageWidth, imageHeight, next));
  const zoomTo = (zoom: number) => update({ ...view, zoom });
  const isDefault =
    view.zoom === DEFAULT_PHOTO_VIEW.zoom &&
    Math.abs(view.centerX - 0.5) < 0.001 &&
    Math.abs(view.centerY - 0.5) < 0.001;
  return { crop, update, zoomTo, isDefault };
}

/**
 * A transparent layer laid over the card's photo area: drag to move the photo,
 * pinch to zoom, or use the arrow keys and +/−. The card itself draws the photo,
 * so what you frame here is exactly what's saved.
 */
export function PhotoFramingLayer(props: FramingProps) {
  const { view } = props;
  const { crop, update, zoomTo, isDefault } = useFraming(props);
  const frameRef = useRef<HTMLDivElement>(null);
  // Active pointers, for dragging (one) and pinch-zooming (two).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(e.pointerId);
    const frame = frameRef.current;
    if (!previous || !frame) return;
    const current = { x: e.clientX, y: e.clientY };

    if (pointers.current.size === 2) {
      // Pinch: scale the zoom by how much the distance between the two fingers changed.
      const [other] = [...pointers.current.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(current.x - other.x, current.y - other.y);
      if (before > 0) zoomTo(view.zoom * (after / before));
    } else {
      // Drag: moving the photo right reveals more of its left side, so the center moves left.
      const { width, height } = frame.getBoundingClientRect();
      update({
        ...view,
        centerX: view.centerX - ((current.x - previous.x) / width) * crop.width,
        centerY: view.centerY - ((current.y - previous.y) / height) * crop.height,
      });
    }
    pointers.current.set(e.pointerId, current);
  }

  function handlePointerEnd(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const pan = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (pan) {
      e.preventDefault();
      update({
        ...view,
        centerX: view.centerX + pan[0] * KEY_PAN_STEP * crop.width,
        centerY: view.centerY + pan[1] * KEY_PAN_STEP * crop.height,
      });
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomTo(view.zoom + ZOOM_STEP);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomTo(view.zoom - ZOOM_STEP);
    }
  }

  return (
    <div
      ref={frameRef}
      role="group"
      tabIndex={0}
      aria-label="Photo position. Drag or use the arrow keys to move it; plus and minus to zoom."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      className={cn(
        "focus-visible:ring-ring/50 absolute inset-0 touch-none outline-none select-none focus-visible:ring-3 focus-visible:ring-inset",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      {/* Rule-of-thirds guides while moving the photo. */}
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 transition-opacity", dragging ? "opacity-100" : "opacity-0")}
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent calc(33.333% - 0.5px), rgba(255,255,255,0.6) calc(33.333% - 0.5px), rgba(255,255,255,0.6) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), rgba(255,255,255,0.6) calc(66.666% - 0.5px), rgba(255,255,255,0.6) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px)), linear-gradient(to bottom, transparent calc(33.333% - 0.5px), rgba(255,255,255,0.6) calc(33.333% - 0.5px), rgba(255,255,255,0.6) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), rgba(255,255,255,0.6) calc(66.666% - 0.5px), rgba(255,255,255,0.6) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px))",
        }}
      />
      {!dragging && isDefault && (
        <span className="pointer-events-none absolute top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs whitespace-nowrap text-white">
          <MoveIcon className="size-3.5" /> Drag to reposition
        </span>
      )}
    </div>
  );
}

/** Zoom slider with −/+ and a reset icon, under the card while framing (as wide as the card). */
export function PhotoZoomControls(props: FramingProps) {
  const { view, onChange } = props;
  const { zoomTo, isDefault } = useFraming(props);
  return (
    <div className="flex w-full items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom out"
        disabled={view.zoom <= MIN_ZOOM}
        onClick={() => zoomTo(view.zoom - ZOOM_STEP)}
      >
        <MinusIcon />
      </Button>
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={0.01}
        value={view.zoom}
        onChange={(e) => zoomTo(Number(e.target.value))}
        aria-label="Zoom"
        className="accent-foreground h-1 min-w-0 flex-1 cursor-pointer"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom in"
        disabled={view.zoom >= MAX_ZOOM}
        onClick={() => zoomTo(view.zoom + ZOOM_STEP)}
      >
        <PlusIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Reset framing"
        title="Reset framing"
        disabled={isDefault}
        onClick={() => onChange(DEFAULT_PHOTO_VIEW)}
      >
        <RotateCcwIcon />
      </Button>
    </div>
  );
}
