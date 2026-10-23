"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon, SparklesIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { createCard, requestPhotoUpload, type CreatedCopyResult, type PickedYouTubeVideo } from "@/app/create/actions";
import { AppleMusicEmbed } from "@/components/apple-music-embed";
import { CollectibleCard, type CardFace } from "@/components/collectible-card";
import { AudienceField, type Audience } from "@/components/create/audience-field";
import { CreatedCopies } from "@/components/create/created-copies";
import { EditionField, parseEditionSize } from "@/components/create/edition-field";
import { PhotoAndColors } from "@/components/create/photo-and-colors";
import { PhotoFramingLayer } from "@/components/create/photo-cropper";
import { RecipientPicker } from "@/components/create/recipient-picker";
import { useActionsAboveKeyboard } from "@/components/create/use-actions-above-keyboard";
import { useIsNarrow } from "@/components/create/use-is-narrow";
import { SongClipPicker, type ClipRange } from "@/components/create/song-clip-picker";
import { YouTubePick } from "@/components/create/youtube-pick";
import { SelectedSong, SongSearch } from "@/components/create/song-search";
import { FlipCard } from "@/components/flip-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildAppleMusicUrl, type SongSearchResult } from "@/lib/apple-music";
import { authClient } from "@/lib/auth/client";
import { signInPath } from "@/lib/auth/sign-in-path";
import { DEFAULT_CARD_COLOR } from "@/lib/card-color";
import { cropFromView, DEFAULT_PHOTO_VIEW, exportCroppedPhoto, readImageSize, type PhotoView } from "@/lib/photo-crop";
import { extractPalette } from "@/lib/photo-palette";
import type { PublicProfile } from "@/lib/profiles";
import { saveClaims } from "@/lib/saved-claims";
import { cn } from "@/lib/utils";
import {
  cardFieldsSchema,
  fieldErrors,
  LIMITS,
  MESSAGE_MAX_LINES,
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

const EMPTY_VALUES: FormValues = {
  songTitle: "",
  artistName: "",
  message: "",
  senderName: "",
  moment: "",
};

/** Keeps at most `maxLines` lines: line breaks past the limit become spaces. */
function capLineBreaks(text: string, maxLines: number) {
  const lines = text.split("\n");
  return lines.length <= maxLines ? text : [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(" ")].join("\n");
}

const FIELD_ORDER: FieldName[] = ["songTitle", "artistName", "message", "senderName", "moment"];
/** Which side of the card a field is printed on, so the preview turns to it while editing. */
const BACK_FIELDS: string[] = ["message", "senderName"];

/**
 * Below lg the form is shown one step at a time under the card, so a step's field and
 * the keyboard fit on screen; the page scrolls normally. On lg+ every step is visible
 * as one form.
 */
const FORM_STEPS: { fields: FieldName[]; optional: boolean }[] = [
  { fields: [], optional: false }, // Who is this card for? (+ recipients)
  { fields: ["songTitle", "artistName"], optional: false },
  { fields: ["message"], optional: true },
  { fields: ["senderName", "moment"], optional: true },
  { fields: [], optional: true }, // Photo & colors
  { fields: [], optional: false }, // Copies
];
const LAST_FORM_STEP = FORM_STEPS.length - 1;
const PHOTO_STEP = 4;
const COPIES_STEP = LAST_FORM_STEP;
const stepOfField = (field: FieldName) => FORM_STEPS.findIndex((s) => s.fields.includes(field));
const isWideScreen = () => window.matchMedia("(min-width: 1024px)").matches;

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
  /** The visible step on narrow screens. */
  const [formStep, setFormStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const narrow = useIsNarrow();
  // Which side the live preview shows: the back on the message step (narrow screens), else the
  // front; focusing a field, or the Front / Back switch, turns it for the current step.
  const [sideChoice, setSideChoice] = useState<{ side: CardFace; step: number } | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [recipients, setRecipients] = useState<PublicProfile[]>([]);
  // A YouTube video the creator pasted on the preview, for the song it was picked for.
  const [youtubePick, setYouTubePick] = useState<{ song: string; video: PickedYouTubeVideo } | null>(null);
  // The song's own YouTube video, found on the preview, for the song it was found for.
  const [matchedVideo, setMatchedVideo] = useState<{ song: string; videoId: string | null } | null>(null);
  // The part of the song the card plays, for the video it was chosen on.
  const [clip, setClip] = useState<(ClipRange & { videoId: string }) | null>(null);
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

  // On a new step, move focus to the step itself (for screen readers) rather than a
  // field: the keyboard or color picker should only open when the person taps them.
  const previousFormStep = useRef(formStep);
  useEffect(() => {
    if (previousFormStep.current === formStep) return;
    previousFormStep.current = formStep;
    if (isWideScreen()) return;
    document.querySelector<HTMLElement>(`[data-form-step="${formStep}"]`)?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [formStep]);

  // With the keyboard open on a phone, keep Back / Next just above it (no blank page below).
  const stepActionsRef = useRef<HTMLDivElement>(null);
  useActionsAboveKeyboard(stepActionsRef, narrow && step === "edit");

  /** Shows a step and focuses the field that needs attention. */
  function showFieldError(field: FieldName | "editionSize") {
    if (field === "editionSize") {
      setFormStep(COPIES_STEP);
      requestAnimationFrame(() => document.getElementById("editionSize")?.focus());
      return;
    }
    setFormStep(stepOfField(field));
    const isSongField = field === "songTitle" || field === "artistName";
    requestAnimationFrame(() =>
      document.getElementById(isSongField && songMode === "search" ? SONG_SEARCH_ID : field)?.focus(),
    );
  }

  /** Whether an optional step was left untouched (its button reads "Skip"). */
  function stepIsEmpty(index: number) {
    if (index === PHOTO_STEP) return !photo && cardColor === DEFAULT_CARD_COLOR && photoAreaColor === null;
    return FORM_STEPS[index].fields.every((f) => !values[f].trim());
  }

  function nextFormStep() {
    const { fields } = FORM_STEPS[formStep];
    if (fields.length > 0) {
      const result = cardFieldsSchema.safeParse(values);
      const all = result.success ? {} : fieldErrors(result.error);
      const failing = fields.filter((f) => all[f]);
      setErrors((prev) => {
        const next = { ...prev };
        for (const f of fields) next[f] = all[f];
        return next;
      });
      if (failing.length > 0) {
        setValidateLive(true);
        showFieldError(failing[0]);
        return;
      }
    }
    if (formStep === LAST_FORM_STEP) {
      formRef.current?.requestSubmit();
      return;
    }
    setFormStep((s) => s + 1);
  }

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
      // The card fits four lines of message: extra line breaks become spaces.
      const value = field === "message" ? capLineBreaks(e.target.value, MESSAGE_MAX_LINES) : e.target.value;
      const next = { ...values, [field]: value };
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
    // Enter in a field on a narrow screen moves to the next step instead of submitting.
    if (!isWideScreen() && formStep < LAST_FORM_STEP) {
      nextFormStep();
      return;
    }
    setValidateLive(true);
    const result = cardFieldsSchema.safeParse(values);
    const edition = parseEditionSize(editionInput);
    setEditionError(edition.error);
    if (!result.success) {
      const nextErrors = fieldErrors(result.error);
      setErrors(nextErrors);
      const first = FIELD_ORDER.find((f) => nextErrors[f]);
      if (first) showFieldError(first);
      return;
    }
    setErrors({});
    if (edition.error) {
      showFieldError("editionSize");
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
        youtubeVideoId: pickedVideo?.videoId ?? null,
        clip: cardClip ? { videoId: cardClip.videoId, start: cardClip.start, end: cardClip.end } : null,
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
    setYouTubePick(null);
    setMatchedVideo(null);
    setClip(null);
    setCopies(null);
    setFormStep(0);
    goTo("edit");
  }

  // The pasted video only counts for the song it was pasted for (the song can change on Edit).
  const songKey = `${song?.trackId ?? ""}|${values.songTitle.trim()}|${values.artistName.trim()}`;
  const pickedVideo = youtubePick?.song === songKey ? youtubePick.video : null;
  // The video the card will play: the creator's pick, else the song's own. A chosen part only
  // counts while it's for that video.
  const cardVideoId = pickedVideo?.videoId ?? (matchedVideo?.song === songKey ? matchedVideo.videoId : null);
  const cardClip = clip && clip.videoId === cardVideoId ? clip : null;

  const previewSide: CardFace =
    sideChoice && sideChoice.step === formStep
      ? sideChoice.side
      : narrow && FORM_STEPS[formStep]?.fields.some((f) => BACK_FIELDS.includes(f))
        ? "back"
        : "front";

  const previewCard = {
    songTitle: values.songTitle.trim() || "Song title",
    artistName: values.artistName.trim() || "Artist",
    photoUrl: photo?.previewUrl,
    photoCrop: photo ? cropFromView(photo.width, photo.height, photo.view) : null,
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
              ? "We've saved it on this device. Sign in and it moves into your collection, or save the link below to keep it later."
              : allYours
                ? "Share the link with anyone; the card stays yours."
                : "Each copy below shows where it stands and the link to send."}
          </p>
        </div>
        <FlipCard
          className="max-w-[340px]"
          hint="Tap the card to see its back"
          front={<CollectibleCard card={previewCard} className="max-w-none" />}
          back={<CollectibleCard card={previewCard} face="back" className="max-w-none" />}
        />
        {keepAfterSignIn && (
          <Button asChild size="lg" className="h-11 w-full">
            <Link href={signInPath("/keepsakes")}>
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
        <FlipCard
          className="max-w-[340px]"
          hint="Tap the card to see its back"
          front={<CollectibleCard card={previewCard} className="max-w-none" />}
          back={<CollectibleCard card={previewCard} face="back" className="max-w-none" />}
        />
        {song && <AppleMusicEmbed url={buildAppleMusicUrl(song)} title={song.title} />}
        <YouTubePick
          key={songKey}
          songTitle={previewCard.songTitle}
          artistName={previewCard.artistName}
          appleMusic={song}
          picked={pickedVideo}
          onPick={(video) => setYouTubePick(video ? { song: songKey, video } : null)}
          onMatch={(videoId) => setMatchedVideo({ song: songKey, videoId })}
        />
        {cardVideoId && (
          <SongClipPicker
            key={cardVideoId}
            videoId={cardVideoId}
            title={`${previewCard.songTitle} by ${previewCard.artistName}`}
            clip={cardClip}
            onChange={(range) => setClip(range ? { ...range, videoId: cardVideoId } : null)}
          />
        )}
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
    // Narrow screens: card on top, the current step below; the page scrolls normally and
    // Safari moves it up when the keyboard opens. lg+: form left, sticky card right.
    <div className="mx-auto flex w-full max-w-6xl flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16 lg:px-6 lg:pt-10 lg:pb-16">
      <div className="px-4 pt-4 sm:px-6 lg:col-start-2 lg:row-start-1 lg:p-0">
        <div className="lg:sticky lg:top-8">
          <div className="mx-auto w-full max-w-[240px] sm:max-w-[280px] lg:max-w-[340px]">
            <FlipCard
              side={previewSide}
              // Taps on the card frame the photo instead; the switch below turns it over.
              tapToFlip={false}
              front={
                <CollectibleCard
                  card={previewCard}
                  className="max-w-none"
                  // The photo is framed right here on the card: on the Photo & colors step on
                  // narrow screens, and whenever there's a photo on wide ones.
                  photoOverlay={
                    photo && (narrow ? formStep === PHOTO_STEP : true) ? (
                      <PhotoFramingLayer
                        imageWidth={photo.width}
                        imageHeight={photo.height}
                        view={photo.view}
                        onChange={setPhotoView}
                      />
                    ) : undefined
                  }
                />
              }
              back={<CollectibleCard card={previewCard} face="back" className="max-w-none" />}
            />
            <div className="mt-3 flex justify-center">
              <div role="group" aria-label="Card side" className="bg-muted flex gap-1 rounded-full p-1 text-xs">
                {(["front", "back"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={previewSide === side}
                    onClick={() => setSideChoice({ side, step: formStep })}
                    className={cn(
                      "h-7 rounded-full px-3 font-medium capitalize transition-colors",
                      previewSide === side ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={handlePreview}
        // Writing the message or signature turns the preview to the back; other fields, the front.
        onFocusCapture={(e) => {
          const name = (e.target as HTMLElement).getAttribute("name");
          if (name && FIELD_ORDER.includes(name as FieldName)) {
            setSideChoice({ side: BACK_FIELDS.includes(name) ? "back" : "front", step: formStep });
          }
        }}
        className="flex flex-col gap-6 px-4 pt-6 pb-10 sm:px-6 lg:col-start-1 lg:row-start-1 lg:p-0"
      >
        {/* No visible title; the heading stays for screen readers and page structure. */}
        <h1 className="sr-only">Create a card</h1>

        {/* Close and, on narrow screens, step progress. */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" className="-ml-1.5 shrink-0" aria-label="Close and go home">
            <Link href="/">
              <XIcon />
            </Link>
          </Button>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums lg:hidden" aria-live="polite">
            {formStep + 1} of {FORM_STEPS.length}
          </span>
          <div className="bg-muted h-1 flex-1 overflow-hidden rounded-full lg:hidden">
            <div
              className="bg-foreground h-full rounded-full transition-[width] duration-300"
              style={{ width: `${((formStep + 1) / FORM_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <FormStep index={0} current={formStep}>
          <AudienceField value={audience} onChange={setAudience} />
          {audience === "others" && (
            <RecipientPicker max={editionSize} value={activeRecipients} onChange={setRecipients} />
          )}
        </FormStep>

        <FormStep index={1} current={formStep}>
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
        </FormStep>

        <FormStep index={2} current={formStep}>
          <TextField name="message" label="Personal message" hint="Written on the back of the card." multiline rows={5} value={values.message} error={errors.message} onChange={handleChange("message")} placeholder="Why this song reminds you of them" />
        </FormStep>

        <FormStep index={3} current={formStep}>
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
        </FormStep>

        <FormStep index={PHOTO_STEP} current={formStep}>
          <PhotoAndColors
            photo={photo && { previewUrl: photo.previewUrl, fileName: photo.file.name, width: photo.width, height: photo.height, view: photo.view }}
            photoError={photoError}
            onPhotoSelect={handlePhotoSelect}
            onPhotoRemove={removePhoto}
            onPhotoViewChange={setPhotoView}
            photoColors={photoColors}
            photoAreaColor={photoAreaColor}
            onPhotoAreaColorChange={setPhotoAreaColor}
            cardColor={cardColor}
            onCardColorChange={setCardColor}
          />
        </FormStep>

        <FormStep index={COPIES_STEP} current={formStep}>
          <EditionField
            value={editionInput}
            error={editionError}
            onChange={(value) => {
              setEditionInput(value);
              if (validateLive) setEditionError(parseEditionSize(value).error);
            }}
          />
        </FormStep>

        {/* Narrow screens: Back / Next right under the field, so it stays above the keyboard. */}
        <div ref={stepActionsRef} className="flex gap-2 lg:hidden">
          {formStep > 0 && (
            <Button type="button" variant="outline" size="lg" className="bg-background h-11 px-5" onClick={() => setFormStep((s) => s - 1)}>
              <ArrowLeftIcon /> Back
            </Button>
          )}
          <Button type="button" size="lg" className="h-11 flex-1" onClick={nextFormStep}>
            {formStep === LAST_FORM_STEP ? (
              <>
                Preview card <ArrowRightIcon />
              </>
            ) : FORM_STEPS[formStep].optional && stepIsEmpty(formStep) ? (
              "Skip"
            ) : (
              <>
                Next <ArrowRightIcon />
              </>
            )}
          </Button>
        </div>

        <Button type="submit" size="lg" className="h-11 max-lg:hidden sm:self-start sm:px-6">
          Preview card <ArrowRightIcon />
        </Button>
      </form>
    </div>
  );
}

/** One step of the form: the only one shown on narrow screens; all shown on lg+. */
function FormStep({ index, current, children }: { index: number; current: number; children: ReactNode }) {
  return (
    <div
      data-form-step={index}
      // Focusable (not tabbable) so a new step can take focus without opening the keyboard.
      tabIndex={-1}
      className={cn("flex flex-col gap-6 outline-none", index !== current && "max-lg:hidden")}
    >
      {children}
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
