"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
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
  /** Told the song's own YouTube video once it's known (null when there isn't one). */
  onMatch: (videoId: string | null) => void;
};

/**
 * On the preview, when the song couldn't be found on YouTube (so the card page would have no
 * player): lets the creator paste a link to the song on YouTube for this card. Shows nothing
 * while checking, when the song was found, or when YouTube isn't set up.
 */
export function YouTubePick({ songTitle, artistName, appleMusic, picked, onPick, onMatch }: YouTubePickProps) {
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
      .catch(() => ({ status: "unavailable" as const, videoId: null }))
      .then((result) => {
        if (!current) return;
        setMatch(result.status);
        onMatch(result.videoId);
      });
    return () => {
      current = false;
    };
    // onMatch is the parent's setter: checked once per song, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songTitle, artistName, appleMusic]);

  // Once a video is picked, the player below shows it (see SongClipPicker), so this steps aside.
  if (match !== "missing" || picked) return null;

  /** Checks a link and, if it's a playable YouTube video, picks it. */
  function check(url: string) {
    if (!url.trim()) return;
    startChecking(async () => {
      const result = await checkYouTubeLink({ url, songTitle });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setLink("");
      onPick(result.video);
    });
  }

  function handleLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    check(link);
  }

  return (
    <section aria-labelledby="youtube-pick-title" className="w-full text-sm">
      <h2 id="youtube-pick-title" className="font-medium">
        We couldn&apos;t find this song on YouTube
      </h2>
      {/* A pasted link is checked straight away (as is Enter); a typed one gets a small arrow
          button inside the field. A spinner sits there while it's checked. */}
      <form onSubmit={handleLink} className="mt-3">
        <div className="relative">
          <Input
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setError(undefined);
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text").trim();
              if (!pasted) return;
              e.preventDefault();
              setLink(pasted);
              setError(undefined);
              check(pasted);
            }}
            inputMode="url"
            autoComplete="off"
            placeholder="Paste a YouTube link to the song"
            aria-label="YouTube link"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "youtube-pick-error" : undefined}
            className="h-10 pr-11"
          />
          <div className="absolute inset-y-0 right-1.5 flex items-center">
            {checking ? (
              <Loader2Icon aria-label="Checking the link" className="text-muted-foreground mr-1.5 size-4 animate-spin" />
            ) : (
              link.trim() && (
                <Button type="submit" size="icon-sm" aria-label="Use this link" title="Use this link">
                  <ArrowRightIcon />
                </Button>
              )
            )}
          </div>
        </div>
        {error && (
          <p id="youtube-pick-error" className="text-destructive mt-2 text-xs">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
