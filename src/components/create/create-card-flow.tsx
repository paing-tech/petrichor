"use client";

import { useEffect, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { createCard, requestPhotoUpload } from "@/app/create/actions";
import { CollectibleCard } from "@/components/collectible-card";
import { PhotoField } from "@/components/create/photo-field";
import { ShareActions } from "@/components/share-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  /** Set once the file is in storage, so a failed save can retry without re-uploading. */
  uploadedKey?: string;
};

type Step = "edit" | "review" | "done";

const EMPTY_VALUES: FormValues = {
  songTitle: "",
  artistName: "",
  songUrl: "",
  lyricsExcerpt: "",
  message: "",
  senderName: "",
};

const FIELD_ORDER: FieldName[] = ["songTitle", "artistName", "songUrl", "lyricsExcerpt", "message", "senderName"];

export function CreateCardFlow() {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<CardFieldErrors>({});
  const [validateLive, setValidateLive] = useState(false);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoError, setPhotoError] = useState<string>();
  const [step, setStep] = useState<Step>("edit");
  const [cardId, setCardId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

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

  function handlePhotoSelect(file: File) {
    const error = validatePhotoFile(file);
    setPhotoError(error ?? undefined);
    if (error) return;
    setPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

  function handlePreview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidateLive(true);
    const result = cardFieldsSchema.safeParse(values);
    if (!result.success) {
      const nextErrors = fieldErrors(result.error);
      setErrors(nextErrors);
      const first = FIELD_ORDER.find((f) => nextErrors[f]);
      if (first) document.getElementById(first)?.focus();
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
        const upload = await requestPhotoUpload({ contentType: photo.file.type, size: photo.file.size });
        if (!upload.ok) {
          setStatus(null);
          toast.error(upload.error);
          return;
        }
        const response = await fetch(upload.uploadUrl, {
          method: "PUT",
          body: photo.file,
          headers: { "Content-Type": photo.file.type },
        }).catch(() => null);
        if (!response?.ok) {
          setStatus(null);
          toast.error("The photo didn't upload. Check your connection and try again.");
          return;
        }
        photoKey = upload.key;
        const uploadedFile = photo.file;
        setPhoto((p) => (p?.file === uploadedFile ? { ...p, uploadedKey: upload.key } : p));
      }

      setStatus("Saving card…");
      const result = await createCard({ ...values, photoKey });
      setStatus(null);

      if (!result.ok) {
        if (result.code === "photo_invalid") {
          setPhoto(null);
          setPhotoError(result.error);
          goTo("edit");
        } else if (result.fieldErrors) {
          setErrors(result.fieldErrors);
          goTo("edit");
        }
        toast.error(result.error);
        return;
      }

      setCardId(result.cardId);
      goTo("done");
    });
  }

  function startOver() {
    setValues(EMPTY_VALUES);
    setErrors({});
    setValidateLive(false);
    setPhoto(null);
    setPhotoError(undefined);
    setCardId(null);
    goTo("edit");
  }

  const previewCard = {
    songTitle: values.songTitle.trim() || "Song title",
    artistName: values.artistName.trim() || "Artist",
    photoUrl: photo?.previewUrl,
    lyricsExcerpt: values.lyricsExcerpt.trim(),
    message: values.message.trim(),
    senderName: values.senderName.trim(),
    cardId,
  };

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
        <CollectibleCard card={previewCard} spinning />
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

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="sr-only">Song</legend>
          <TextField name="songTitle" label="Song title" required value={values.songTitle} error={errors.songTitle} onChange={handleChange("songTitle")} placeholder="Here Comes the Sun" />
          <TextField name="artistName" label="Artist" required value={values.artistName} error={errors.artistName} onChange={handleChange("artistName")} placeholder="The Beatles" />
          <TextField
            name="songUrl"
            label="Song link"
            type="url"
            inputMode="url"
            value={values.songUrl}
            error={errors.songUrl}
            onChange={handleChange("songUrl")}
            placeholder="https://open.spotify.com/track/…"
            hint="Spotify or YouTube"
            className="sm:col-span-2"
          />
        </fieldset>

        <PhotoField
          previewUrl={photo?.previewUrl ?? null}
          fileName={photo?.file.name ?? null}
          error={photoError}
          onSelect={handlePhotoSelect}
          onRemove={() => {
            setPhoto(null);
            setPhotoError(undefined);
          }}
        />

        <TextField name="lyricsExcerpt" label="Lyrics excerpt" multiline rows={2} value={values.lyricsExcerpt} error={errors.lyricsExcerpt} onChange={handleChange("lyricsExcerpt")} placeholder="The line that says it best" />
        <TextField name="message" label="Personal message" multiline rows={4} value={values.message} error={errors.message} onChange={handleChange("message")} placeholder="Why this song reminds you of them" />
        <TextField name="senderName" label="Your name" value={values.senderName} error={errors.senderName} onChange={handleChange("senderName")} placeholder="How you'd like to sign it" />

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
  type?: string;
  inputMode?: "url" | "text";
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
