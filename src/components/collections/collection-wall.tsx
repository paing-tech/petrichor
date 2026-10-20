"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, cubicBezier, motion } from "motion/react";
import { LoaderCircleIcon, MinusIcon, PlusIcon, SquareIcon } from "lucide-react";
import { toast } from "sonner";
import { updatePhotoCaption } from "@/app/collections/actions";
import { AutoHide } from "@/components/collections/auto-hide";
import {
  InfiniteMasonry,
  type MasonryHandle,
  type MasonryItem,
} from "@/components/collections/infinite-masonry";
import type { CollectionPhoto } from "@/lib/collections";
import { cn } from "@/lib/utils";
import { PHOTO_CAPTION_MAX } from "@/lib/validation";

/**
 * The wall is laid out in columns of equal width; each photo keeps its own shape, so the
 * heights vary (masonry). Each column repeats on its own (see InfiniteMasonry), so the gaps
 * are all equal.
 */
const COLUMNS = 4;
/**
 * Column width and the gap (between columns, between photos): phones, then wider screens, at
 * the starting zoom. Both scale with the zoom (pinch, Ctrl/⌘ + scroll, or the − / + buttons).
 */
const WALL_SIZES =
  "[--column-width:calc(9rem*var(--zoom))] [--gap:calc(2.75rem*var(--zoom))] md:[--column-width:calc(18rem*var(--zoom))] md:[--gap:calc(5rem*var(--zoom))]";
/** Each tap of − or + zooms the wall by this much. */
const ZOOM_STEP = 1.25;
/**
 * When the wall opens, its photos grow in one by one (in random order, over about a second).
 * Photos added later (more repeats as you zoom out) just appear.
 */
const ENTRANCE_MS = 1500;
const tileEntrance = {
  hidden: { opacity: 0, scale: 0.3 },
  shown: () => ({
    opacity: 1,
    scale: 1,
    transition: { delay: Math.random() * 0.8 + 0.2, duration: 1.4, ease: cubicBezier(0.18, 0.71, 0.11, 1) },
  }),
};
/** True while the wall is opening, so tiles mounted then play the entrance. */
const OpeningContext = createContext(true);
/** Fewer photos than this are repeated, so each column has a few to cycle through. */
const MIN_TILES = COLUMNS * 3;
/** The gap between photos, as a fraction of the column's width (to keep columns even). */
const COLUMN_GAP_RATIO = 0.25;
/** A press that moves further than this (px) is a drag, not a tap. */
const TAP_SLOP = 8;
/** After a drag or a scroll the wall keeps gliding this long (ms); a tap then only stops it. */
const GLIDE_MS = 700;
/** An opened photo fills at most this much of the screen's width and height. */
const FOCUS_MAX_WIDTH = "80vw";
const FOCUS_MAX_HEIGHT = "65dvh";
/**
 * The frame's border (white on a black wall, black on a white one), the same on every side,
 * as a fraction of the photo's width.
 */
const FRAME_BORDER = 0.005;
/** Space between the photo (or its frame) and the caption below it. */
const CAPTION_GAP = "0.75rem";
/** Remembers, per browser, whether opened photos show in a frame. */
const FRAME_STORAGE_KEY = "petrichor:photo-frame";
/** Opening a photo cross-fades: the wall fades away as the photo fades in. */
const FADE_TRANSITION = { duration: 0.5, ease: [0.22, 1, 0.36, 1] } as const;

/**
 * A collection's photos on an endless wall you drag (or scroll) around. Tap a photo to see
 * it alone in the middle, whole, at its original quality.
 */
export function CollectionWall({ photos }: { photos: CollectionPhoto[] }) {
  const [open, setOpen] = useState<CollectionPhoto | null>(null);
  // Captions edited here, shown straight away (null: removed).
  const [captions, setCaptions] = useState<Record<string, string | null>>({});
  // Only used once a photo is opened (never in the first render), so reading storage here is safe.
  const [framed, setFramed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(FRAME_STORAGE_KEY) === "framed";
    } catch {
      return false;
    }
  });
  // Tells a tap from the end of a drag, or from a tap that stops the wall gliding.
  const press = useRef({ x: 0, y: 0, glidingUntil: 0, wasGliding: false });
  const wall = useRef<MasonryHandle>(null);
  const [opening, setOpening] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setOpening(false), ENTRANCE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (photos.length === 0) return null;
  const tiles = Array.from(
    { length: Math.max(photos.length, Math.ceil(MIN_TILES / photos.length) * photos.length) },
    (_, i) => ({ photo: photos[i % photos.length], key: `${photos[i % photos.length].id}-${i}` }),
  );
  // Each photo goes into the shortest column so far (unless the same photo just went there).
  const columns: (typeof tiles)[] = Array.from({ length: COLUMNS }, () => []);
  const lengths: number[] = Array(COLUMNS).fill(0);
  for (const tile of tiles) {
    const order = lengths.map((_, i) => i).sort((a, b) => lengths[a] - lengths[b]);
    const target = order.find((i) => columns[i].at(-1)?.photo.id !== tile.photo.id) ?? order[0];
    columns[target].push(tile);
    lengths[target] += tile.photo.height / tile.photo.width + COLUMN_GAP_RATIO;
  }
  const items: MasonryItem[][] = columns.map((column) =>
    column.map(({ photo, key }) => ({
      key,
      content: (
        <Tile ratio={`${photo.width} / ${photo.height}`}>
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
              const moved = Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > TAP_SLOP;
              // Keyboard presses (no pointer position) always open.
              const fromPointer = event.detail > 0;
              if (open || (fromPointer && (moved || press.current.wasGliding))) return;
              setOpen(photo);
            }}
          />
        </Tile>
      ),
    })),
  );

  return (
    <>
      <motion.div
        animate={{ opacity: open ? 0 : 1 }}
        transition={FADE_TRANSITION}
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
        <OpeningContext value={opening}>
          <InfiniteMasonry ref={wall} columns={items} className={cn("bg-(--wall)", WALL_SIZES)} />
        </OpeningContext>
      </motion.div>
      {/* Zoom buttons on wider screens (phones pinch), fading away like the other controls. */}
      {!open && (
        <AutoHide className="absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] hidden sm:block">
          <div className="flex items-center rounded-full bg-(--wall-ink)/10 p-0.5 text-(--wall-ink) backdrop-blur">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => wall.current?.zoomBy(1 / ZOOM_STEP)}
              className="grid size-9 place-items-center rounded-full transition-colors hover:bg-(--wall-ink)/10"
            >
              <MinusIcon className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => wall.current?.zoomBy(ZOOM_STEP)}
              className="grid size-9 place-items-center rounded-full transition-colors hover:bg-(--wall-ink)/10"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        </AutoHide>
      )}
      <AnimatePresence>
        {open && (
          <FocusedPhoto
            key={open.id}
            photo={open}
            caption={open.id in captions ? captions[open.id] : open.caption}
            onCaptionSaved={(caption) => setCaptions((current) => ({ ...current, [open.id]: caption }))}
            framed={framed}
            onFramedChange={(on) => {
              setFramed(on);
              try {
                localStorage.setItem(FRAME_STORAGE_KEY, on ? "framed" : "none");
              } catch {}
            }}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/** A photo on the wall, at its own shape; grows in if it appears while the wall is opening. */
function Tile({ ratio, children }: { ratio: string; children: ReactNode }) {
  const opening = useContext(OpeningContext);
  const [entrance] = useState(opening);
  return (
    <motion.div
      className="relative overflow-hidden rounded-sm will-change-transform hover:cursor-pointer"
      style={{ aspectRatio: ratio }}
      variants={tileEntrance}
      initial={entrance ? "hidden" : false}
      animate="shown"
    >
      {children}
    </motion.div>
  );
}

/**
 * One photo, alone in the middle of the wall's colour, whole and as large as fits (bare, or
 * in an even white frame), with its caption below. The preview (already loaded) shows at
 * once; the original replaces it when it arrives. Tap anywhere else or press Escape to go
 * back to the wall.
 */
function FocusedPhoto({
  photo,
  caption,
  onCaptionSaved,
  framed,
  onFramedChange,
  onClose,
}: {
  photo: CollectionPhoto;
  caption: string | null;
  onCaptionSaved: (caption: string | null) => void;
  framed: boolean;
  onFramedChange: (framed: boolean) => void;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const ratio = photo.width / photo.height;

  useEffect(() => {
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
      className="fixed inset-0 z-70 grid place-items-center"
    >
      {/* Covers the wall (and the bar above it) in the wall's own colour. */}
      <motion.div
        className="absolute inset-0 bg-(--wall)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={FADE_TRANSITION}
      />
      <motion.div
        className="relative"
        // The photo's width; the frame is sized from it.
        style={{ "--photo-w": `min(${FOCUS_MAX_WIDTH}, ${FOCUS_MAX_HEIGHT} * ${ratio})` } as CSSProperties}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={FADE_TRANSITION}
      >
        <div
          className={cn(
            "transition-[background-color,padding,box-shadow] duration-500",
            framed && "bg-(--wall-ink) shadow-2xl",
          )}
          style={{ padding: framed ? `calc(var(--photo-w) * ${FRAME_BORDER})` : 0 }}
        >
          <div
            className="relative w-(--photo-w)"
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
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
              <span className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs whitespace-nowrap text-white/80 backdrop-blur">
                <LoaderCircleIcon className="size-3 animate-spin" /> Loading original
              </span>
            )}
          </div>
        </div>
        {/* Below the photo, outside the frame; right-aligned to its edge. */}
        <div className="absolute inset-x-0 top-full flex" style={{ paddingTop: CAPTION_GAP }}>
          <Caption photoId={photo.id} caption={caption} onSaved={onCaptionSaved} />
        </div>
      </motion.div>
      <button
        type="button"
        aria-pressed={framed}
        onClick={(event) => {
          event.stopPropagation();
          onFramedChange(!framed);
        }}
        className={cn(
          "absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm backdrop-blur transition-colors",
          framed ? "bg-(--wall-ink) text-(--wall)" : "bg-(--wall-ink)/10 text-(--wall-ink)/80 hover:bg-(--wall-ink)/20",
        )}
      >
        <SquareIcon className="size-4" /> Frame
      </button>
    </div>
  );
}

/**
 * A photo's caption, under it when opened. Tap it (or "Add a caption") to write one: Enter
 * or tapping away saves, Escape cancels. Clearing the text removes it.
 */
function Caption({
  photoId,
  caption,
  onSaved,
}: {
  photoId: string;
  caption: string | null;
  onSaved: (caption: string | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const saving = useRef(false);

  async function save() {
    if (draft === null || saving.current) return;
    if (draft.trim() === (caption ?? "")) {
      setDraft(null);
      return;
    }
    saving.current = true;
    const result = await updatePhotoCaption({ photoId, caption: draft });
    saving.current = false;
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onSaved(result.caption);
    setDraft(null);
  }

  return (
    <div
      // Taps on the caption don't close the photo.
      onClick={(event) => event.stopPropagation()}
      className="w-full text-left"
    >
      {draft !== null ? (
        <input
          autoFocus
          value={draft}
          maxLength={PHOTO_CAPTION_MAX}
          aria-label="Caption"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            } else if (event.key === "Escape") {
              // Cancels the edit without closing the photo.
              event.stopPropagation();
              setDraft(null);
            }
          }}
          className="w-full bg-transparent text-left font-outfit text-sm text-(--wall-ink) outline-none"
        />
      ) : caption ? (
        <button
          type="button"
          onClick={() => setDraft(caption)}
          className="font-outfit text-sm leading-snug text-(--wall-ink) transition-colors"
        >
          {caption}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setDraft("")}
          className="text-sm text-(--wall-ink)/35 transition-colors hover:text-(--wall-ink)/60"
        >
          Add a caption
        </button>
      )}
    </div>
  );
}
