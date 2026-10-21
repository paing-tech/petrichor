import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MusicLibrary, type LibraryTrack } from "@/components/library/music-library";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/auth/account";
import { signInPath } from "@/lib/auth/sign-in-path";
import { listLibrary } from "@/lib/ownership";
import { getSongMatches } from "@/lib/song-matching";

export const metadata: Metadata = { title: "Music Library", robots: { index: false } };

/** Every song from the keepsakes in the user's collection, playable here through YouTube. */
export default function LibraryPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 pb-16 sm:px-6">
      <Suspense fallback={<h1 className="font-serif text-4xl tracking-tight">Music Library</h1>}>
        <Library />
      </Suspense>
    </div>
  );
}

async function Library() {
  const account = await getAccount();
  if (!account) redirect(signInPath("/library"));
  if (!account.profile) redirect("/onboarding?next=/library");

  const cards = await listLibrary(account.user.id);
  // Each song is looked up once (matches are stored, so this is quick after the first time).
  const lookups = new Map<string, Promise<string | null>>();
  const tracks: LibraryTrack[] = await Promise.all(
    cards.map(async (card) => {
      const key = `${card.appleMusicUrl ?? ""}|${card.songTitle}|${card.artistName}`;
      if (!lookups.has(key)) {
        lookups.set(
          key,
          getSongMatches({ title: card.songTitle, artist: card.artistName, appleMusicUrl: card.appleMusicUrl }).then(
            (m) => m.youtubeVideoId,
          ),
        );
      }
      return {
        cardId: card.cardId,
        songTitle: card.songTitle,
        artistName: card.artistName,
        moment: card.moment,
        photoUrl: card.photoUrl,
        photoAreaColor: card.photoAreaColor,
        youtubeVideoId: await lookups.get(key)!,
      };
    }),
  );

  return (
    <>
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Music Library</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {tracks.length === 0
            ? "The songs from your keepsakes, all in one place."
            : `${tracks.length} song${tracks.length === 1 ? "" : "s"} from your keepsakes`}
        </p>
      </div>
      {tracks.length === 0 ? (
        <div className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
          Songs from the cards you keep will play here.{" "}
          <Button asChild variant="link" className="h-auto p-0">
            <Link href="/create">Make a card</Link>
          </Button>
        </div>
      ) : (
        <MusicLibrary tracks={tracks} />
      )}
    </>
  );
}
