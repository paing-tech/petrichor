"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Loader2Icon, XIcon } from "lucide-react";
import { checkYouTubeLink, checkYouTubeMatch, type PickedYouTubeVideo } from "@/app/create/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppleMusicTrack } from "@/lib/apple-music";

type YouTubePickProps = {
  songTitle: string;
  artistName: string;
  /** The picked catalog song (state, so its identity holds between renders); null when typed in. */
  appleMusic: AppleMusicTrack | null;
  picked: PickedYouTubeVideo | null;
  onPick: (video: PickedYouTubeVideo | null) => void;
};

/**
 * On the preview, when the song couldn't be found on YouTube (so the card page would have no
 * player): lets the creator paste a link to the song on YouTube for this card. Shows nothing
 * while checking, when the song was found, or when YouTube isn't set up.
 */
export function YouTubePick({ songTitle, artistName, appleMusic, picked, onPick }: YouTubePickProps) {
  const [match, setMatch] = useState<"checking" | "found" | "missing" | "unavailable">("checking");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string>();
  const [checking, startChecking] = useTransition();

  useEffect(() => {
    let current = true;
    const track = appleMusic
      ? { storefront: appleMusic.storefront, collectionId: appleMusic.collectionId, trackId: appleMusic.trackId }
      : null;
    checkYouTubeMatch({ songTitle, artistName, appleMusic: track })
      .catch(() => "unavailable" as const)
      .then((result) => current && setMatch(result));
    return () => {
      current = false;
    };
  }, [songTitle, artistName, appleMusic]);

  if (match !== "missing") return null;

  function handleLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!link.trim()) return;
    startChecking(async () => {
      const result = await checkYouTubeLink({ url: link, songTitle });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setLink("");
      onPick(result.video);
    });
  }

  return (
    <section aria-labelledby="youtube-pick-title" className="w-full rounded-2xl border p-4 text-sm">
      <h2 id="youtube-pick-title" className="font-medium">
        We couldn&apos;t find this song on YouTube
      </h2>
      <p className="text-muted-foreground mt-1">
        So the card can&apos;t play it. Paste a YouTube link to the song to play instead (optional).
      </p>

      {picked ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            {/* YouTube's own thumbnail for the video. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${picked.videoId}/mqdefault.jpg`}
              alt=""
              className="bg-muted aspect-video w-20 shrink-0 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate">{picked.title}</p>
              <p className="text-muted-foreground truncate text-xs">{picked.channel}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove this video" onClick={() => onPick(null)}>
              <XIcon />
            </Button>
          </div>
          {!picked.namesSong && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              This video&apos;s title doesn&apos;t mention “{songTitle}”. Make sure it&apos;s the right song.
            </p>
          )}
        </>
      ) : (
        <form onSubmit={handleLink} className="mt-3">
          <div className="flex gap-2">
            <Input
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setError(undefined);
              }}
              inputMode="url"
              autoComplete="off"
              placeholder="youtube.com/watch?v=…"
              aria-label="YouTube link"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "youtube-pick-error" : undefined}
              className="h-10"
            />
            <Button type="submit" variant="outline" className="h-10 px-4" disabled={checking || !link.trim()}>
              {checking ? <Loader2Icon className="animate-spin" /> : "Use"}
            </Button>
          </div>
          {error && (
            <p id="youtube-pick-error" className="text-destructive mt-2 text-xs">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
