"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlusIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { createCollection } from "@/app/photos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadCollectionPhotos } from "@/lib/collection-upload";
import { COLLECTION_TITLE_MAX, MAX_COLLECTION_PHOTOS } from "@/lib/validation";

type Picked = { file: File; url: string };

/** "New collection": a name and a batch of photos, uploaded together. */
export function NewCollection({ startOpen = false }: { startOpen?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(startOpen);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  // Free the previews' object URLs when they're removed or the form goes away.
  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);
  useEffect(() => () => pickedRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function addFiles(files: FileList | null) {
    const images = [...(files ?? [])].filter((file) => !file.type || file.type.startsWith("image/"));
    const room = MAX_COLLECTION_PHOTOS - picked.length;
    if (images.length > room) toast.error(`A collection can hold up to ${MAX_COLLECTION_PHOTOS} photos.`);
    setPicked((current) => [
      ...current,
      ...images.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  }

  function remove(url: string) {
    URL.revokeObjectURL(url);
    setPicked((current) => current.filter((p) => p.url !== url));
  }

  async function save() {
    const name = title.trim();
    if (!name) {
      toast.error("Give your collection a name.");
      return;
    }
    try {
      const photos = await uploadCollectionPhotos(
        picked.map((p) => p.file),
        (done, total) => setStatus(`Uploading ${done} of ${total}…`),
      );
      setStatus("Saving…");
      const result = await createCollection({ title: name, photos });
      if (!result.ok) throw new Error(result.error);
      router.push(`/photos/${result.collectionId}`);
    } catch (error) {
      setStatus(null);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="h-10 rounded-full px-5">
        <PlusIcon /> New collection
      </Button>
    );
  }

  const busy = status !== null;
  return (
    <section className="bg-background grid w-full gap-4 rounded-2xl border p-4 sm:p-5">
      <div className="grid gap-1.5">
        <Label htmlFor="collection-title">Name</Label>
        <Input
          id="collection-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Japan trip"
          maxLength={COLLECTION_TITLE_MAX}
          disabled={busy}
          autoFocus
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {picked.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-muted-foreground hover:text-foreground hover:border-foreground/30 grid place-items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-sm transition-colors"
        >
          <ImagePlusIcon className="size-6" />
          Choose photos
          <span className="text-xs">Kept at their original size and quality</span>
        </button>
      ) : (
        <div className="grid gap-3">
          {/* Each photo at its own shape, as it'll be kept. */}
          <ul className="columns-3 gap-2 sm:columns-4 lg:columns-6">
            {picked.map((p) => (
              <li key={p.url} className="relative mb-2 break-inside-avoid">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={p.url} alt="" className="block h-auto w-full rounded-lg" />
                {!busy && (
                  <button
                    type="button"
                    onClick={() => remove(p.url)}
                    aria-label={`Remove ${p.file.name}`}
                    className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {picked.length} photo{picked.length === 1 ? "" : "s"}
            </span>
            {!busy && (
              <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
                <PlusIcon /> Add more
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            picked.forEach((p) => URL.revokeObjectURL(p.url));
            setPicked([]);
            setTitle("");
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || picked.length === 0}>
          {status ?? "Create collection"}
        </Button>
      </div>
    </section>
  );
}
