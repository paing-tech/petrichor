"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { createCard, requestPhotoUpload } from "@/app/create/actions";
import { AppleMusicEmbed } from "@/components/apple-music-embed";
import { CollectibleCard } from "@/components/collectible-card";
import { ColorField, type ColorSwatch } from "@/components/create/color-field";
import { EditionField, parseEditionSize } from "@/components/create/edition-field";
import { PhotoCropper } from "@/components/create/photo-cropper";
import { PhotoField } from "@/components/create/photo-field";
import { SelectedSong, SongSearch } from "@/components/create/song-search";
import { EditionLinks } from "@/components/edition-links";
import { ShareActions } from "@/components/share-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildAppleMusicUrl, type SongSearchResult } from "@/lib/apple-music";
import {
  DEFAULT_CARD_COLOR,
  EARTH_PHOTO_AREA,
  EARTH_PHOTO_AREA_TONE,
  PRESET_CARD_COLORS,
} from "@/lib/card-color";
import { cropFromView, DEFAULT_PHOTO_VIEW, exportCroppedPhoto, readImageSize, type PhotoView } from "@/lib/photo-crop";
import { extractPalette } from "@/lib/photo-palette";
import { cn } from "@/lib/utils";
import {
  cardFieldsSchema,
  fieldErrors,
  LIMITS,
  validatePhotoFile,
  type CardFieldErrors,
} from "@/lib/validation";

type FieldName = keyof typeof LIMITS;
type FormValues = Record<FieldName, string>;

type Photo = {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  /** How the sender framed the photo; only this area is uploaded. */
  view: PhotoView;
  /** Set once the cropped photo is in storage, so a failed save can retry without re-uploading. */
  uploadedKey?: string;
};

type Step = "edit" | "review" | "done";

/** "search" picks from the Apple Music catalog; "manual" is the fallback for songs it doesn't have. */
type SongMode = "search" | "manual";

const SONG_SEARCH_ID = "song-search";

const WHITE_AND_BLACK: ColorSwatch[] = PRESET_CARD_COLORS.map((c) => ({ label: c.name, value: c.value }));

const PHOTO_AREA_SWATCHES: ColorSwatch[] = [
  { label: "Earth (default)", value: null, background: EARTH_PHOTO_AREA, checkBackground: EARTH_PHOTO_AREA_TONE },
  ...WHITE_AND_BLACK,
];

const EMPTY_VALUES: FormValues = {
  songTitle: "",
  artistName: "",
  lyricsExcerpt: "",
  message: "",
  senderName: "",
  moment: "",
};

const FIELD_ORDER: FieldName[] = ["songTitle", "artistName", "lyricsExcerpt", "message", "senderName", "moment"];

const subscribeNoop = () => () => {};

/**
 * The sender's local date (YYYY-MM-DD) for the preview, read only in the browser
 * so the static prerender stays date-free. The card prints it as-is (UTC).
 */
function useToday() {
  return useSyncExternalStore(subscribeNoop, () => new Date().toLocaleDateString("en-CA"), () => null);
}

export function CreateCardFlow() {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<CardFieldErrors>({});
  const [validateLive, setValidateLive] = useState(false);
  const [song, setSong] = useState<SongSearchResult | null>(null);
  const [songMode, setSongMode] = useState<SongMode>("search");
  const [focusSearch, setFocusSearch] = useState(false);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoError, setPhotoError] = useState<string>();
  const [photoColors, setPhotoColors] = useState<string[]>([]);
  const [cardColor, setCardColor] = useState(DEFAULT_CARD_COLOR);
  const [photoAreaColor, setPhotoAreaColor] = useState<string | null>(null);
  // The most recently picked file, so a slow palette extraction for an older photo is ignored.
  const latestPhotoFile = useRef<File | null>(null);
  const [step, setStep] = useState<Step>("edit");
  const [editionInput, setEditionInput] = useState("1");
  const [editionError, setEditionError] = useState<string>();
  /** The created card IDs in edition order; one entry for a single card. */
  const [cardIds, setCardIds] = useState<string[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const today = useToday();
  // Falls back to 1 while the field holds something invalid; the preview step re-checks it.
  const editionSize = parseEditionSize(editionInput).size ?? 1;

  const previewUrl = photo?.previewUrl;
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function validate(next: FormValues) {
    const result = cardFieldsSchema.safeParse(next);
    setErrors(result.success ? {} : fieldErrors(result.error));
    return result.success;
  }

  function handleChange(field: FieldName) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = { ...values, [field]: e.target.value };
      setValues(next);
      if (validateLive) validate(next);
    };
  }

  function setSongFields(songTitle: string, artistName: string) {
    const next = { ...values, songTitle, artistName };
    setValues(next);
    if (validateLive) validate(next);
  }

  function handleSongSelect(selected: SongSearchResult) {
    setSong(selected);
    setSongFields(selected.title, selected.artist);
  }

  function changeSong(mode: SongMode) {
    setSong(null);
    setSongMode(mode);
    setFocusSearch(mode === "search");
    setSongFields("", "");
  }

  async function handlePhotoSelect(file: File) {
    const error = validatePhotoFile(file);
    setPhotoError(error ?? undefined);
    if (error) return;

    latestPhotoFile.current = file;
    setPhotoColors([]);
    const previewUrl = URL.createObjectURL(file);
    let size: { width: number; height: number };
    try {
      size = await readImageSize(previewUrl);
    } catch {
      URL.revokeObjectURL(previewUrl);
      setPhotoError("This image couldn't be opened in your browser. Try a JPEG or PNG.");
      return;
    }
    if (latestPhotoFile.current !== file) {
      URL.revokeObjectURL(previewUrl);
      return;
    }
    setPhoto({ file, previewUrl, ...size, view: DEFAULT_PHOTO_VIEW });

    extractPalette(file)
      .then((colors) => {
        if (latestPhotoFile.current === file) setPhotoColors(colors);
      })
      .catch(() => {
        // Colors are a nice-to-have; the presets and custom picker still work.
      });
  }

  function setPhotoView(view: PhotoView) {
    // A new framing means a new image, so any earlier upload no longer matches.
    setPhoto((p) => (p ? { ...p, view, uploadedKey: undefined } : p));
  }

  function removePhoto() {
    latestPhotoFile.current = null;
    setPhoto(null);
    setPhotoError(undefined);
    setPhotoColors([]);
  }

  function handlePreview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidateLive(true);
    const result = cardFieldsSchema.safeParse(values);
    const edition = parseEditionSize(editionInput);
    setEditionError(edition.error);
    if (!result.success) {
      const nextErrors = fieldErrors(result.error);
      setErrors(nextErrors);
      const first = FIELD_ORDER.find((f) => nextErrors[f]);
      const isSongField = first === "songTitle" || first === "artistName";
      if (first) document.getElementById(isSongField && songMode === "search" ? SONG_SEARCH_ID : first)?.focus();
      return;
    }
    setErrors({});
    if (edition.error) {
      document.getElementById("editionSize")?.focus();
      return;
    }
    goTo("review");
  }

  function goTo(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleConfirm() {
    startSaving(async () => {
      let photoKey = photo?.uploadedKey ?? null;

      if (photo && !photoKey) {
        setStatus("Uploading photo…");
        let image: Blob;
        try {
          image = await exportCroppedPhoto(photo.previewUrl, cropFromView(photo.width, photo.height, photo.view));
        } catch {
          setStatus(null);
          toast.error("We couldn't prepare your photo. Try choosing it again.");
          return;
        }
        const upload = await requestPhotoUpload({ contentType: image.type, size: image.size });
        if (!upload.ok) {
          setStatus(null);
          toast.error(upload.error);
          return;
        }
        const response = await fetch(upload.uploadUrl, {
          method: "PUT",
          body: image,
          headers: { "Content-Type": image.type },
        }).catch(() => null);
        if (!response?.ok) {
          setStatus(null);
          toast.error("The photo didn't upload. Check your connection and try again.");
          return;
        }
        photoKey = upload.key;
        const uploaded = photo;
        setPhoto((p) => (p?.file === uploaded.file && p.view === uploaded.view ? { ...p, uploadedKey: upload.key } : p));
      }

      setStatus("Saving card…");
      const appleMusic = song
        ? { storefront: song.storefront, collectionId: song.collectionId, trackId: song.trackId }
        : null;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
      const result = await createCard({
        ...values,
        photoKey,
        appleMusic,
        timeZone,
        cardColor,
        photoAreaColor: photo ? null : photoAreaColor,
        editionSize,
      });
      setStatus(null);

      if (!result.ok) {
        if (result.code === "photo_invalid") {
          removePhoto();
          setPhotoError(result.error);
          goTo("edit");
        } else if (result.fieldErrors) {
          setErrors(result.fieldErrors);
          goTo("edit");
        }
        toast.error(result.error);
        return;
      }

      setCardIds(result.cardIds);
      goTo("done");
    });
  }

  function startOver() {
    setValues(EMPTY_VALUES);
    setErrors({});
    setValidateLive(false);
    setSong(null);
    setSongMode("search");
    setFocusSearch(false);
    removePhoto();
    setCardColor(DEFAULT_CARD_COLOR);
    setPhotoAreaColor(null);
    setEditionInput("1");
    setEditionError(undefined);
    setCardIds(null);
    goTo("edit");
  }

  const previewCard = {
    songTitle: values.songTitle.trim() || "Song title",
    artistName: values.artistName.trim() || "Artist",
    photoUrl: photo?.previewUrl,
    photoCrop: photo ? cropFromView(photo.width, photo.height, photo.view) : null,
    lyricsExcerpt: values.lyricsExcerpt.trim(),
    message: values.message.trim(),
    senderName: values.senderName.trim(),
    moment: values.moment.trim(),
    createdAt: today,
    cardColor,
    photoAreaColor,
    editionNumber: 1,
    editionSize,
    cardId: cardIds?.[0] ?? null,
  };

  if (step === "done" && cardIds && cardIds.length > 1) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 pt-4 pb-16">
        <div className="text-center">
          <p className="text-clay mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
            <SparklesIcon className="size-4" /> Edition created
          </p>
          <h1 className="font-serif text-4xl tracking-tight">Your {cardIds.length} cards are ready</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Numbered 1 to {cardIds.length}, each with its own link. Anyone with a link can open that card — no
            account needed.
          </p>
        </div>
        <CollectibleCard card={previewCard} />
        {song && <AppleMusicEmbed url={buildAppleMusicUrl(song)} title={song.title} />}
        <EditionLinks cardIds={cardIds} />
        <Button variant="ghost" size="lg" className="h-10" onClick={startOver}>
          Make another
        </Button>
      </div>
    );
  }

  const cardId = cardIds?.[0];
  if (step === "done" && cardId) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 pt-4 pb-16">
        <div className="text-center">
          <p className="text-clay mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
            <SparklesIcon className="size-4" /> Card created
          </p>
          <h1 className="font-serif text-4xl tracking-tight">Your card is ready</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Anyone with the link can open it — no account needed.
          </p>
        </div>
        <CollectibleCard card={previewCard} />
        {song && <AppleMusicEmbed url={buildAppleMusicUrl(song)} title={song.title} />}
        <ShareActions path={`/c/${cardId}`} title={`${previewCard.songTitle} — a Petrichor card`} showUrl />
        <div className="flex w-full gap-2">
          <Button asChild variant="outline" size="lg" className="h-10 flex-1">
            <Link href={`/c/${cardId}`}>Open card</Link>
          </Button>
          <Button variant="ghost" size="lg" className="h-10 flex-1" onClick={startOver}>
            Make another
          </Button>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 pt-4 pb-16">
        <div className="text-center">
          <h1 className="font-serif text-4xl tracking-tight">Looks good?</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {editionSize > 1
              ? `This creates ${editionSize} numbered cards, 1 of ${editionSize} to ${editionSize} of ${editionSize}, each with its own link. `
              : ""}
            Cards can&apos;t be changed after they&apos;re created.
          </p>
        </div>
        <CollectibleCard card={previewCard} />
        <div className="flex w-full gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-10 flex-1"
            disabled={isSaving}
            onClick={() => goTo("edit")}
          >
            <ArrowLeftIcon /> Edit
          </Button>
          <Button size="lg" className="h-10 flex-1" disabled={isSaving} onClick={handleConfirm}>
            {isSaving ? (
              <>
                <Loader2Icon className="animate-spin" /> {status ?? "Saving…"}
              </>
            ) : editionSize > 1 ? (
              `Create ${editionSize} cards`
            ) : (
              "Create card"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
      <div className="lg:col-start-2 lg:row-start-1">
        <div className="lg:sticky lg:top-8">
          <p className="text-muted-foreground mb-3 text-center text-xs font-medium tracking-widest uppercase">
            Live preview
          </p>
          <CollectibleCard card={previewCard} className="mx-auto max-w-[280px] sm:max-w-[320px] lg:max-w-[400px]" />
        </div>
      </div>

      <form noValidate onSubmit={handlePreview} className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
        <div>
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Make a card</h1>
          <p className="text-muted-foreground mt-2">
            Pick a song, add a moment, and send it to someone.
          </p>
        </div>

        {songMode === "manual" ? (
          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="sr-only">Song</legend>
            <TextField name="songTitle" label="Song title" required value={values.songTitle} error={errors.songTitle} onChange={handleChange("songTitle")} placeholder="Here Comes the Sun" />
            <TextField name="artistName" label="Artist" required value={values.artistName} error={errors.artistName} onChange={handleChange("artistName")} placeholder="The Beatles" />
            <button
              type="button"
              onClick={() => changeSong("search")}
              className="text-muted-foreground hover:text-foreground -mt-2 justify-self-start text-xs underline underline-offset-2 sm:col-span-2"
            >
              Search Apple Music instead
            </button>
          </fieldset>
        ) : song ? (
          <SelectedSong song={song} onChange={() => changeSong("search")} />
        ) : (
          <SongSearch
            inputId={SONG_SEARCH_ID}
            autoFocus={focusSearch}
            error={errors.songTitle || errors.artistName ? "Search for a song and pick it from the list." : undefined}
            onSelect={handleSongSelect}
            onEnterManually={() => changeSong("manual")}
          />
        )}

        <PhotoField
          previewUrl={photo?.previewUrl ?? null}
          fileName={photo?.file.name ?? null}
          error={photoError}
          onSelect={handlePhotoSelect}
          onRemove={removePhoto}
        >
          {photo ? (
            <PhotoCropper
              src={photo.previewUrl}
              imageWidth={photo.width}
              imageHeight={photo.height}
              view={photo.view}
              onChange={setPhotoView}
            />
          ) : (
            <ColorField
              id="photo-area-color"
              label="Photo area color"
              value={photoAreaColor}
              swatches={PHOTO_AREA_SWATCHES}
              customFallback={EARTH_PHOTO_AREA_TONE}
              hint="Fills the top of the card when there's no photo."
              onChange={setPhotoAreaColor}
            />
          )}
        </PhotoField>

        <ColorField
          id="card-color"
          label="Card color"
          value={cardColor}
          swatches={[
            ...WHITE_AND_BLACK,
            ...photoColors.map((color, i) => ({ label: `Photo color ${i + 1}`, value: color, gapBefore: i === 0 })),
          ]}
          customFallback={cardColor}
          hint={
            photoColors.length > 0
              ? "White, black, colors from your photo, or pick your own."
              : "Add a photo to get colors picked from it."
          }
          onChange={(color) => setCardColor(color ?? DEFAULT_CARD_COLOR)}
        />

        <TextField name="lyricsExcerpt" label="Lyrics excerpt" multiline rows={2} value={values.lyricsExcerpt} error={errors.lyricsExcerpt} onChange={handleChange("lyricsExcerpt")} placeholder="The line that says it best" />
        <TextField name="message" label="Personal message" multiline rows={4} value={values.message} error={errors.message} onChange={handleChange("message")} placeholder="Why this song reminds you of them" />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="senderName" label="Your name" value={values.senderName} error={errors.senderName} onChange={handleChange("senderName")} placeholder="How you'd like to sign it" />
          <TextField name="moment" label="Moment" value={values.moment} error={errors.moment} onChange={handleChange("moment")} placeholder="Birthday party, graduation, a place…" />
        </div>

        <EditionField
          value={editionInput}
          error={editionError}
          onChange={(value) => {
            setEditionInput(value);
            if (validateLive) setEditionError(parseEditionSize(value).error);
          }}
        />

        <Button type="submit" size="lg" className="h-11 sm:self-start sm:px-6">
          Preview card <ArrowRightIcon />
        </Button>
      </form>
    </div>
  );
}

type TextFieldProps = {
  name: FieldName;
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
  className?: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

function TextField({ name, label, value, error, required, multiline, rows, hint, className, ...inputProps }: TextFieldProps) {
  const max = LIMITS[name];
  const describedBy = `${name}-message`;
  const shared = {
    id: name,
    name,
    value,
    required,
    "aria-invalid": !!error,
    "aria-describedby": describedBy,
    className: "bg-background",
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={name}>
        {label}
        {!required && <span className="text-muted-foreground font-normal">(optional)</span>}
      </Label>
      {multiline ? (
        <Textarea {...shared} rows={rows} onChange={inputProps.onChange} placeholder={inputProps.placeholder} className="bg-background resize-none" />
      ) : (
        <Input {...shared} {...inputProps} className="bg-background h-10" />
      )}
      <div id={describedBy} className="flex justify-between gap-3 text-xs">
        <span className={error ? "text-destructive" : "text-muted-foreground"}>{error ?? hint}</span>
        <span className={value.length > max ? "text-destructive tabular-nums" : "text-muted-foreground tabular-nums"}>
          {value.length}/{max}
        </span>
      </div>
    </div>
  );
}
