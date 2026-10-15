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
import { createCard, requestPhotoUpload, type CreatedCopyResult } from "@/app/create/actions";
import { AppleMusicEmbed } from "@/components/apple-music-embed";
import { CollectibleCard } from "@/components/collectible-card";
import { AudienceField, type Audience } from "@/components/create/audience-field";
import { ColorField, type ColorSwatch } from "@/components/create/color-field";
import { CreatedCopies } from "@/components/create/created-copies";
import { EditionField, parseEditionSize } from "@/components/create/edition-field";
import { PhotoCropper } from "@/components/create/photo-cropper";
import { PhotoField } from "@/components/create/photo-field";
import { RecipientPicker } from "@/components/create/recipient-picker";
import { SelectedSong, SongSearch } from "@/components/create/song-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildAppleMusicUrl, type SongSearchResult } from "@/lib/apple-music";
import { authClient } from "@/lib/auth/client";
import {
  DEFAULT_CARD_COLOR,
  EARTH_PHOTO_AREA,
  EARTH_PHOTO_AREA_TONE,
  PRESET_CARD_COLORS,
} from "@/lib/card-color";
import { cropFromView, DEFAULT_PHOTO_VIEW, exportCroppedPhoto, readImageSize, type PhotoView } from "@/lib/photo-crop";
import { extractPalette } from "@/lib/photo-palette";
import type { PublicProfile } from "@/lib/profiles";
import { saveClaims } from "@/lib/saved-claims";
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
  const [audience, setAudience] = useState<Audience>("self");
  const [anonymous, setAnonymous] = useState(false);
  const [recipients, setRecipients] = useState<PublicProfile[]>([]);
  /** The created copies in edition order, with each one's link and status. */
  const [copies, setCopies] = useState<CreatedCopyResult[] | null>(null);
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const today = useToday();
  // Falls back to 1 while the field holds something invalid; the preview step re-checks it.
  const editionSize = parseEditionSize(editionInput).size ?? 1;
  // One recipient per copy; extra picks are dropped if the edition shrinks.
  const activeRecipients = audience === "others" ? recipients.slice(0, editionSize) : [];
  const signatureHidden = audience === "others" && anonymous;

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
        audience,
        anonymous: signatureHidden,
        recipientUserIds: activeRecipients.map((r) => r.userId),
      });
      setStatus(null);

      if (!result.ok) {
        if (result.code === "needs_profile") {
          toast.error(result.error, {
            action: { label: "Set up", onClick: () => window.open("/onboarding?next=/keepsakes", "_blank") },
          });
          return;
        }
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

      // Made "for myself" while signed out: remember the claim codes in this browser so
      // signing in moves the cards into the collection automatically.
      const unclaimedOwn = result.copies.filter((c) => audience === "self" && c.claimToken);
      if (unclaimedOwn.length) saveClaims(unclaimedOwn.map((c) => ({ cardId: c.cardId, token: c.claimToken! })));
      setCopies(result.copies);
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
    setAnonymous(false);
    setRecipients([]);
    setCopies(null);
    goTo("edit");
  }

  const previewCard = {
    songTitle: values.songTitle.trim() || "Song title",
    artistName: values.artistName.trim() || "Artist",
    photoUrl: photo?.previewUrl,
    photoCrop: photo ? cropFromView(photo.width, photo.height, photo.view) : null,
    lyricsExcerpt: values.lyricsExcerpt.trim(),
    message: values.message.trim(),
    senderName: signatureHidden ? "" : values.senderName.trim(),
    moment: values.moment.trim(),
    createdAt: today,
    cardColor,
    photoAreaColor,
    editionNumber: 1,
    editionSize,
    cardId: copies?.[0]?.cardId ?? null,
  };

  if (step === "done" && copies) {
    const size = copies.length;
    const allYours = copies.every((c) => c.ownedByYou);
    const keepAfterSignIn = audience === "self" && copies.some((c) => c.claimToken);
    const heading = allYours
      ? size > 1
        ? `Your ${size} cards are in your collection`
        : "It's in your collection"
      : keepAfterSignIn
        ? size > 1
          ? "Sign in to keep your cards"
          : "Sign in to keep your card"
        : size > 1
          ? `Your ${size} cards are ready`
          : "Your card is ready";
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 pt-4 pb-16">
        <div className="text-center">
          <p className="text-clay mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
            <SparklesIcon className="size-4" /> {size > 1 ? "Edition created" : "Card created"}
          </p>
          <h1 className="font-serif text-4xl tracking-tight">{heading}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {keepAfterSignIn
              ? "We've saved it on this device. Sign in and it moves into your collection — or keep the claim links below."
              : allYours
                ? "Share the view link with anyone; the card stays yours."
                : "Each copy below shows where it stands and the link to send."}
          </p>
        </div>
        <CollectibleCard card={previewCard} />
        {song && <AppleMusicEmbed url={buildAppleMusicUrl(song)} title={song.title} />}
        {keepAfterSignIn && (
          <Button asChild size="lg" className="h-11 w-full">
            <Link href="/sign-in?next=/keepsakes">
              <SparklesIcon /> Sign in to keep {size > 1 ? "them" : "it"}
            </Link>
          </Button>
        )}
        {allYours && (
          <Button asChild size="lg" variant="outline" className="h-11 w-full">
            <Link href="/keepsakes">Go to my keepsakes</Link>
          </Button>
        )}
        <CreatedCopies copies={copies} />
        <Button variant="ghost" size="lg" className="h-10" onClick={startOver}>
          Make another
        </Button>
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
            {audience === "self"
              ? signedIn
                ? "They'll go straight into your collection. "
                : "Sign in afterwards to keep them in your collection. "
              : activeRecipients.length > 0
                ? `${activeRecipients.length === 1 ? "Your recipient accepts" : "Each recipient accepts"} before it's theirs. `
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
            Pick a song, add a moment, and keep it as a collectible — for yourself or someone else.
          </p>
        </div>

        <AudienceField value={audience} onChange={setAudience} />
        {audience === "others" && (
          <RecipientPicker max={editionSize} value={activeRecipients} onChange={setRecipients} />
        )}

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
          <div className="grid gap-2">
            <TextField
              name="senderName"
              label="Signature"
              value={signatureHidden ? "" : values.senderName}
              error={errors.senderName}
              onChange={handleChange("senderName")}
              placeholder={signatureHidden ? "Sent anonymously" : "How you'd like to sign it"}
              disabled={signatureHidden}
            />
            {audience === "others" && (
              <label className="-mt-1 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="accent-foreground size-4"
                />
                Send anonymously
              </label>
            )}
          </div>
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
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

function TextField({ name, label, value, error, required, multiline, rows, hint, className, disabled, ...inputProps }: TextFieldProps) {
  const max = LIMITS[name];
  const describedBy = `${name}-message`;
  const shared = {
    id: name,
    name,
    value,
    required,
    disabled,
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
