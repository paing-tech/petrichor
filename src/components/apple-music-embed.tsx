import { appleMusicEmbedUrl } from "@/lib/apple-music";
import { cn } from "@/lib/utils";

type AppleMusicEmbedProps = {
  /** Canonical track URL, e.g. https://music.apple.com/us/album/123?i=456 */
  url: string;
  title: string;
  className?: string;
};

/**
 * Apple's official embedded player. On sites other than Apple's it plays a preview (up to
 * 90 seconds), even for signed-in subscribers, who get "Add" and "View in App" for the full
 * song in Apple Music.
 */
export function AppleMusicEmbed({ url, title, className }: AppleMusicEmbedProps) {
  const src = appleMusicEmbedUrl(url);
  if (!src) return null;

  return (
    <iframe
      src={src}
      title={`Listen to ${title} on Apple Music`}
      loading="lazy"
      // Apple's own embed settings, without a sandbox: its "Sign In" opens an Apple ID popup,
      // and a sandbox would carry its limits into that popup and can break subscriber sign-in.
      allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write; storage-access *"
      // 150px is Apple's most compact layout that still shows everything uncut (its logo,
      // Play / View in App and the "See how your data is managed" notice); any shorter
      // clips Apple's controls or privacy notice.
      className={cn("h-[150px] w-full overflow-hidden rounded-xl border-0 bg-transparent", className)}
    />
  );
}
