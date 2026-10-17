import { appleMusicEmbedUrl } from "@/lib/apple-music";
import { cn } from "@/lib/utils";

type AppleMusicEmbedProps = {
  /** Canonical track URL, e.g. https://music.apple.com/us/album/123?i=456 */
  url: string;
  title: string;
  className?: string;
};

/**
 * Apple's official embedded player. It plays a 30-second preview for anyone
 * and the full song for signed-in subscribers.
 */
export function AppleMusicEmbed({ url, title, className }: AppleMusicEmbedProps) {
  const src = appleMusicEmbedUrl(url);
  if (!src) return null;

  return (
    <iframe
      src={src}
      title={`Listen to ${title} on Apple Music`}
      loading="lazy"
      allow="autoplay *; encrypted-media *; clipboard-write"
      sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
      // 150px is Apple's most compact layout that still shows everything uncut (its logo,
      // Play / View in App and the "See how your data is managed" notice); any shorter
      // clips Apple's controls or privacy notice.
      className={cn("h-[150px] w-full overflow-hidden rounded-xl border-0 bg-transparent", className)}
    />
  );
}
