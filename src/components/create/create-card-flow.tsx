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
import { ArrowLeftIcon, ArrowRightIcon, SparklesIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { createCard, requestPhotoUpload, type CreatedCopyResult, type PickedYouTubeVideo } from "@/app/create/actions";
import { CollectibleCard, type CardFace } from "@/components/collectible-card";
import { CreatedCopies } from "@/components/create/created-copies";
import { PhotoAndColors } from "@/components/create/photo-and-colors";
import { PhotoFramingLayer, PhotoZoomControls } from "@/components/create/photo-cropper";
import { useActionsAboveKeyboard } from "@/components/create/use-actions-above-keyboard";
import { useIsNarrow } from "@/components/create/use-is-narrow";
import { SendSheet } from "@/components/create/send-sheet";
import { SongClipPicker, type ClipRange } from "@/components/create/song-clip-picker";
import { YouTubePick } from "@/components/create/youtube-pick";
import { SelectedSong, SongSearch } from "@/components/create/song-search";
import { FlipCard } from "@/components/flip-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SongSearchResult } from "@/lib/apple-music";
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
 * The form, one step at a time under the card (on every screen), so a step's field and the
 * keyboard fit on screen; the page scrolls normally. It opens on the song.
 */
const FORM_STEPS: { fields: FieldName[]; optional: boolean }[] = [
  { fields: ["songTitle", "artistName"], optional: false },
  { fields: ["message", "senderName"], optional: true }, // The back: note and signature
  { fields: ["moment"], optional: true }, // The front: photo, card color, place or occasion
];
const LAST_FORM_STEP = FORM_STEPS.length - 1;
const SONG_STEP = 0;
const NOTE_STEP = 1;
const PHOTO_STEP = 2;
const stepOfField = (field: FieldName) => FORM_STEPS.findIndex((s) => s.fields.includes(field));

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
  // The most recently picked file, so a slow palette extraction for an older photo is ignored.
  const latestPhotoFile = useRef<File | null>(null);
  const [step, setStep] = useState<Step>("edit");
  // Who gets a copy, chosen in the sheet that opens from the preview: you (copy 1), people,
  // and copies with a share link.
  const [sendOpen, setSendOpen] = useState(false);
  const [keepForMe, setKeepForMe] = useState(true);
  const [linkCopies, setLinkCopies] = useState(0);
  /** The step on screen (one at a time, on every screen). */
  const [formStep, setFormStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const narrow = useIsNarrow();
  // Which side the live preview shows: the back on the message and signature steps, else the
  // front; focusing a field, or the Front / Back switch, turns it for the current step.
  const [sideChoice, setSideChoice] = useState<{ side: CardFace; step: number } | null>(null);
  const [recipients, setRecipients] = useState<PublicProfile[]>([]);
  // A YouTube video the creator pasted on the preview, for the song it was picked for.
  const [youtubePick, setYouTubePick] = useState<{ song: string; video: PickedYouTubeVideo } | null>(null);
  // The song's own YouTube video, found on the preview, for the song it was found for.
  const [matchedVideo, setMatchedVideo] = useState<{ song: string; videoId: string | null } | null>(null);
  // The part of the song the card plays, for the video it was chosen on.
  const [clip, setClip] = useState<(ClipRange & { videoId: string }) | null>(null);
  /** The created copies in edition order, with each one's link and status. */
  const [copies, setCopies] = useState<CreatedCopyResult[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const today = useToday();
  // Everyone who gets a copy, numbered in this order: you, the people, the links (at least 1).
  const editionSize = Math.max(1, (keepForMe ? 1 : 0) + recipients.length + linkCopies);

  // On a new step, move focus to the step itself (for screen readers) rather than a
  // field: the keyboard or color picker should only open when the person taps them.
  const previousFormStep = useRef(formStep);
  useEffect(() => {
    if (previousFormStep.current === formStep) return;
    previousFormStep.current = formStep;
    document.querySelector<HTMLElement>(`[data-form-step="${formStep}"]`)?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [formStep]);

  // With the keyboard open on a phone, keep Back / Next just above it (no blank page below).
  const stepActionsRef = useRef<HTMLDivElement>(null);
  useActionsAboveKeyboard(stepActionsRef, narrow && step === "edit");

  /** Shows a step and focuses the field that needs attention. */
  function showFieldError(field: FieldName) {
    setFormStep(stepOfField(field));
    const isSongField = field === "songTitle" || field === "artistName";
    requestAnimationFrame(() =>
      document.getElementById(isSongField && songMode === "search" ? SONG_SEARCH_ID : field)?.focus(),
    );
  }

  /** Whether an optional step was left untouched (its button reads "Skip"). */
  function stepIsEmpty(index: number) {
    if (index === PHOTO_STEP) return !photo && cardColor === DEFAULT_CARD_COLOR && !values.moment.trim();
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
    // Enter in a field moves to the next step; on the last one it previews the card.
    if (formStep < LAST_FORM_STEP) {
      nextFormStep();
      return;
    }
    setValidateLive(true);
    const result = cardFieldsSchema.safeParse(values);
    if (!result.success) {
      const nextErrors = fieldErrors(result.error);
      setErrors(nextErrors);
      const first = FIELD_ORDER.find((f) => nextErrors[f]);
      if (first) showFieldError(first);
      return;
    }
    setErrors({});
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

      setStatus("Saving keepsake…");
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
        // One color per card now: a card without a photo tones its top from the card color.
        photoAreaColor: null,
        keepForMe,
        recipientUserIds: recipients.map((r) => r.userId),
        linkCopies,
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
        } else if (result.fieldErrors && Object.keys(result.fieldErrors).some((f) => f in EMPTY_VALUES)) {
          setSendOpen(false);
          setErrors(result.fieldErrors);
          goTo("edit");
        }
        toast.error(result.error);
        return;
      }

      // Your own copy, made while signed out: remember its claim code in this browser so
      // signing in moves it into the collection automatically.
      const unclaimedOwn = result.copies.filter((c) => c.forYou && c.claimToken);
      if (unclaimedOwn.length) saveClaims(unclaimedOwn.map((c) => ({ cardId: c.cardId, token: c.claimToken! })));
      setSendOpen(false);
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
    setRecipients([]);
    setKeepForMe(true);
    setLinkCopies(0);
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
      : FORM_STEPS[formStep]?.fields.some((f) => BACK_FIELDS.includes(f))
        ? "back"
        : "front";

  const previewCard = {
    songTitle: values.songTitle.trim() || "Song title",
    artistName: values.artistName.trim() || "Artist",
    photoUrl: photo?.previewUrl,
    photoCrop: photo ? cropFromView(photo.width, photo.height, photo.view) : null,
    message: values.message.trim(),
    senderName: values.senderName.trim(),
    moment: values.moment.trim(),
    createdAt: today,
    cardColor,
    editionNumber: 1,
    editionSize,
    cardId: copies?.[0]?.cardId ?? null,
  };

  if (step === "done" && copies) {
    const size = copies.length;
    const allYours = copies.every((c) => c.ownedByYou);
    const keepAfterSignIn = copies.some((c) => c.forYou && c.claimToken);
    const heading = allYours
      ? size > 1
        ? `Your ${size} keepsakes are in your collection`
        : "It's in your collection"
      : keepAfterSignIn
        ? size > 1
          ? "Sign in to save your keepsakes"
          : "Sign in to save your keepsake"
        : size > 1
          ? `Your ${size} keepsakes are ready`
          : "Your keepsake is ready";
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 pt-4 pb-16">
        <div className="text-center">
          <p className="text-clay mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
            <SparklesIcon className="size-4" /> {size > 1 ? "Edition created" : "Keepsake created"}
          </p>
          <h1 className="font-serif text-4xl tracking-tight">{heading}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {keepAfterSignIn
              ? "We've saved it on this device. Sign in and it moves into your collection, or save the link below to keep it later."
              : allYours
                ? "Share the link with anyone; the keepsake stays yours."
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
        </div>
        <FlipCard
          className="max-w-[340px]"
          hint="Tap the card to see its back"
          front={<CollectibleCard card={previewCard} className="max-w-none" />}
          back={<CollectibleCard card={previewCard} face="back" className="max-w-none" />}
        />
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
            songTitle={previewCard.songTitle}
            artist={previewCard.artistName}
            clip={cardClip}
            onChange={(range) => setClip(range ? { ...range, videoId: cardVideoId } : null)}
            // A pasted video shows straight away, with its caution and a way to swap it.
            startOpen={!!pickedVideo}
            warning={pickedVideo && !pickedVideo.namesSong ? "Make sure it's the right song." : undefined}
            onReplace={pickedVideo ? () => setYouTubePick(null) : undefined}
          />
        )}
        <div className="flex w-full gap-2">
          {/* The same Back / forward pair as the steps before. */}
          <Button
            variant="outline"
            size="lg"
            className="bg-background px-5"
            disabled={isSaving}
            onClick={() => goTo("edit")}
          >
            <ArrowLeftIcon /> Back
          </Button>
          {/* Next: who gets a copy (the sheet below makes the card). */}
          <Button size="lg" className="flex-1" disabled={isSaving} onClick={() => setSendOpen(true)}>
            Continue <ArrowRightIcon />
          </Button>
        </div>
        <SendSheet
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          keepForMe={keepForMe}
          onKeepForMeChange={setKeepForMe}
          recipients={recipients}
          onRecipientsChange={setRecipients}
          linkCopies={linkCopies}
          onLinkCopiesChange={setLinkCopies}
          saving={isSaving}
          status={status}
          onCreate={handleConfirm}
        />
      </div>
    );
  }

  return (
    // On every screen: the card on top, the current step below; the page scrolls normally and
    // Safari moves it up when the keyboard opens.
    <div className="mx-auto flex w-full max-w-lg flex-col">
      <div className="px-4 pt-4 sm:px-6">
        <div>
          <div className="mx-auto w-full max-w-[240px] sm:max-w-[280px]">
            <FlipCard
              side={previewSide}
              // Taps on the card frame the photo instead; the switch below turns it over.
              tapToFlip={false}
              front={
                <CollectibleCard
                  card={previewCard}
                  className="max-w-none"
                  // The photo is framed right here on the card, on the Photo & colors step.
                  photoOverlay={
                    photo && formStep === PHOTO_STEP ? (
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
            {/* Under the card: on the photo step, the photo's zoom (the photo is on the front, so
                there's no side to choose); on the others, the Front / Back switch. */}
            <div className="mt-3 flex min-h-9 justify-center">
              {formStep === PHOTO_STEP ? (
                photo && (
                  <PhotoZoomControls
                    imageWidth={photo.width}
                    imageHeight={photo.height}
                    view={photo.view}
                    onChange={setPhotoView}
                  />
                )
              ) : (
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
              )}
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
        className="flex flex-col gap-6 px-4 pt-6 pb-10 sm:px-6"
      >
        {/* No visible title; the heading stays for screen readers and page structure. */}
        <h1 className="sr-only">Create a card</h1>

        {/* Close and the step progress. */}
        <div className="flex items-center pl-2 gap-3">
          <Button asChild variant="ghost" size="icon-lg" className="-ml-1.5 shrink-0" aria-label="Close and go home">
            <Link href="/">
              <XIcon className="size-6" />
            </Link>
          </Button>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums" aria-live="polite">
            {formStep + 1} of {FORM_STEPS.length}
          </span>
          <div className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-foreground h-full rounded-full transition-[width] duration-300"
              style={{ width: `${((formStep + 1) / FORM_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <FormStep index={SONG_STEP} current={formStep}>
          {songMode === "manual" ? (
            <fieldset className="grid gap-5">
              <legend className="sr-only">Song</legend>
              <TextField name="songTitle" label="Song title" required value={values.songTitle} error={errors.songTitle} onChange={handleChange("songTitle")} />
              <TextField name="artistName" label="Artist" required value={values.artistName} error={errors.artistName} onChange={handleChange("artistName")} />
              <button
                type="button"
                onClick={() => changeSong("search")}
                className="text-muted-foreground hover:text-foreground -mt-2 justify-self-start text-xs underline underline-offset-2"
              >
                Search instead
              </button>
            </fieldset>
          ) : song ? (
            <SelectedSong song={song} onChange={() => changeSong("search")} />
          ) : (
            <SongSearch
              inputId={SONG_SEARCH_ID}
              autoFocus={focusSearch}
              error={errors.songTitle || errors.artistName ? "Choose a song to continue." : undefined}
              onSelect={handleSongSelect}
              onEnterManually={() => changeSong("manual")}
            />
          )}
        </FormStep>

        {/* The back of the card: the note, signed beneath it. */}
        <FormStep index={NOTE_STEP} current={formStep}>
          <div className="grid gap-5">
            <TextField name="message" label="Note" hint="Written on the back of the card." multiline rows={5} counterFrom={0.8} value={values.message} error={errors.message} onChange={handleChange("message")} />
            <div className="grid gap-2">
              <TextField
                name="senderName"
                label="Signature"
                value={values.senderName}
                error={errors.senderName}
                onChange={handleChange("senderName")}
                placeholder="Your name"
              />
            </div>
          </div>
        </FormStep>

        <FormStep index={PHOTO_STEP} current={formStep}>
          <PhotoAndColors
            photo={photo && { previewUrl: photo.previewUrl, fileName: photo.file.name, width: photo.width, height: photo.height, view: photo.view }}
            photoError={photoError}
            onPhotoSelect={handlePhotoSelect}
            onPhotoRemove={removePhoto}
            photoColors={photoColors}
            cardColor={cardColor}
            onCardColorChange={setCardColor}
          />
          <TextField name="moment" label="Place or occasion" value={values.moment} error={errors.moment} onChange={handleChange("moment")} placeholder="Yangon, graduation, our first date..." />
        </FormStep>

        {/* Back / Next right under the field, so on a phone it stays above the keyboard. */}
        <div ref={stepActionsRef} className="flex gap-2">
          {formStep > 0 && (
            <Button type="button" variant="outline" size="lg" className="bg-background px-5" onClick={() => setFormStep((s) => s - 1)}>
              <ArrowLeftIcon /> Back
            </Button>
          )}
          <Button type="button" size="lg" className="flex-1" onClick={nextFormStep}>
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

        {/* Never shown: it lets Enter in a field submit the form (which moves to the next step). */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </div>
  );
}

/** One step of the form, shown only while it's the current one. */
function FormStep({ index, current, children }: { index: number; current: number; children: ReactNode }) {
  return (
    <div
      data-form-step={index}
      // Focusable (not tabbable) so a new step can take focus without opening the keyboard.
      tabIndex={-1}
      className={cn("flex flex-col gap-6 outline-none", index !== current && "hidden")}
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
  /**
   * How full (0–1) the field gets before its character count appears. By default only once
   * it's over the limit; long writing (the message) shows it as the limit nears.
   */
  counterFrom?: number;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

function TextField({ name, label, value, error, required, multiline, rows, hint, className, disabled, counterFrom, ...inputProps }: TextFieldProps) {
  const max = LIMITS[name];
  const over = value.length > max;
  // Kept out of sight until it matters, so the form stays clean.
  const showCount = over || (counterFrom !== undefined && value.length >= max * counterFrom);
  const note = error ?? hint;
  const describedBy = note || showCount ? `${name}-message` : undefined;
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
      {/* No "(optional)": an optional step's button reads Skip until something's filled in. */}
      <Label htmlFor={name}>{label}</Label>
      {multiline ? (
        <Textarea {...shared} rows={rows} onChange={inputProps.onChange} placeholder={inputProps.placeholder} className="bg-background resize-none" />
      ) : (
        <Input {...shared} {...inputProps} className="bg-background h-10" />
      )}
      {describedBy && (
        <div id={describedBy} className="flex justify-between gap-3 text-xs">
          <span className={error ? "text-destructive" : "text-muted-foreground"}>{note}</span>
          {showCount && (
            <span className={over ? "text-destructive tabular-nums" : "text-muted-foreground tabular-nums"}>
              {value.length}/{max}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
