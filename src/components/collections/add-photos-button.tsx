"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlusIcon } from "lucide-react";
import { toast } from "sonner";
import { addCollectionPhotos } from "@/app/collections/actions";
import { uploadCollectionPhotos } from "@/lib/collection-upload";

/** Uploads more photos to the end of a collection. */
export function AddPhotosButton({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function add(files: File[]) {
    if (files.length === 0) return;
    try {
      const photos = await uploadCollectionPhotos(files, (done, total) =>
        setStatus(`${done} of ${total}`),
      );
      setStatus("Saving…");
      const result = await addCollectionPhotos({ collectionId, photos });
      if (!result.ok) throw new Error(result.error);
      toast.success(`Added ${result.added} photo${result.added === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          void add([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status !== null}
        className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm text-white backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-70"
      >
        <ImagePlusIcon className="size-4" />
        {status ?? "Add photos"}
      </button>
    </>
  );
}
