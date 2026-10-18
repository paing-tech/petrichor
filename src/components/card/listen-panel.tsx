"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowUpRightIcon, PlayIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appleMusicEmbedUrl } from "@/lib/apple-music";
import { YouTubeSpace } from "@/components/card/youtube-space";
import { cn } from "@/lib/utils";

// The card page's player: a "Listen" button under the card that opens one service's
// official player (Apple Music, Spotify or YouTube, the viewer's choice, remembered on this
// device). The card shrinks only when the card and the open player wouldn't both fit on screen.

export type ListenService = "apple" | "spotify" | "youtube";

export type ListenSources = {
  title: string;
  artist: string;
  appleMusicUrl: string | null;
  spotifyTrackId: string | null;
  youtubeVideoId: string | null;
};

const STORAGE_KEY = "petrichor:listen-service";
const LABELS: Record<ListenService, string> = { apple: "Apple Music", spotify: "Spotify", youtube: "YouTube" };
/** Space kept below the open player when fitting the card, in px. */
const BOTTOM_MARGIN = 16;
/** The card never shrinks below this width, in px. */
const MIN_CARD_WIDTH = 220;

type Layout = {
  open: boolean;
  setOpen: (open: boolean) => void;
  cardRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  cardWidth: number | null;
  setCardWidth: (width: number | null) => void;
};

const LayoutContext = createContext<Layout | null>(null);

/** Shares the player's state between the card (which may shrink) and the player below it. */
export function ListenLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cardWidth, setCardWidth] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  return (
    <LayoutContext.Provider value={{ open, setOpen, cardRef, panelRef, cardWidth, setCardWidth }}>
      {children}
    </LayoutContext.Provider>
  );
}

/** Wraps the card; narrows it (keeping its shape) only while the player needs the room. */
export function CardFrame({ children }: { children: ReactNode }) {
  const layout = useContext(LayoutContext);
  return (
    <div
      ref={layout?.cardRef}
      className="mx-auto flex w-full justify-center transition-[max-width] duration-500 ease-out motion-reduce:transition-none"
      style={{ maxWidth: layout?.cardWidth ?? undefined }}
    >
      {children}
    </div>
  );
}

const subscribeNoop = () => () => {};
const readSaved = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) as ListenService | null;
  } catch {
    return null;
  }
};

export function ListenPanel({ sources }: { sources: ListenSources }) {
  const layout = useContext(LayoutContext);
  const available = (["apple", "spotify", "youtube"] as const).filter((s) =>
    s === "apple" ? !!sources.appleMusicUrl : s === "spotify" ? !!sources.spotifyTrackId : !!sources.youtubeVideoId,
  );
  const saved = useSyncExternalStore(subscribeNoop, readSaved, () => null);
  const [picked, setPicked] = useState<ListenService | null>(null);
  // First visit: YouTube, the only player that plays the full song in the page for everyone
  // (Apple's embed plays previews on other sites, even for subscribers; Spotify's plays full
  // songs only on desktop when signed in). After that, the viewer's own choice.
  const fallback = available.find((s) => s === "youtube") ?? available[0];
  const service = [picked, saved].find((s): s is ListenService => !!s && available.includes(s)) ?? fallback;

  const open = layout?.open ?? false;

  function choose(next: ListenService) {
    setPicked(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered in private browsing; the choice still applies on this page.
    }
  }

  // Fit the card and the open player on screen together, shrinking the card only if needed.
  const fit = useCallback(() => {
    if (!layout) return;
    const card = layout.cardRef.current;
    const panel = layout.panelRef.current;
    if (!card || !panel || !layout.open) return layout.setCardWidth(null);
    const cardRect = card.getBoundingClientRect();
    const naturalWidth = card.parentElement?.clientWidth ?? cardRect.width;
    const cardTop = cardRect.top + window.scrollY;
    const below = panel.getBoundingClientRect().bottom - cardRect.bottom; // caption + gaps + player
    const room = window.innerHeight - cardTop - below - BOTTOM_MARGIN;
    const naturalHeight = (Math.min(naturalWidth, 420) * 4) / 3;
    layout.setCardWidth(room >= naturalHeight ? null : Math.max(MIN_CARD_WIDTH, Math.floor((room * 3) / 4)));
  }, [layout]);

  useEffect(() => {
    if (!open || !layout) return;
    fit();
    const observer = new ResizeObserver(fit);
    if (layout.panelRef.current) observer.observe(layout.panelRef.current);
    window.addEventListener("resize", fit);
    // Bring the card and the player into view together (the header too, which the fit counts).
    window.scrollTo({ top: 0, behavior: "smooth" });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [open, service, fit, layout]);

  useEffect(() => {
    if (!open) layout?.setCardWidth(null);
  }, [open, layout]);

  if (!service) return null;

  if (!open) {
    return (
      <Button size="lg" variant="outline" className="bg-background h-11 w-full" onClick={() => layout?.setOpen(true)}>
        <PlayIcon className="fill-current" /> Listen
      </Button>
    );
  }

  return (
    <div ref={layout?.panelRef} className="grid w-full scroll-mb-4 gap-2">
      <div className="flex items-center gap-1">
        {available.length > 1 ? (
          <div role="tablist" aria-label="Listen on" className="bg-muted flex flex-1 gap-1 rounded-full p-1">
            {available.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={s === service}
                onClick={() => choose(s)}
                className={cn(
                  "h-8 flex-1 rounded-full text-sm font-medium transition-colors",
                  s === service ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {LABELS[s]}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground flex-1 text-sm">Listening on {LABELS[service]}</p>
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Close player" onClick={() => layout?.setOpen(false)}>
          <XIcon />
        </Button>
      </div>
      <Player service={service} sources={sources} />
      {/* Apple's player has its own "View in App"; Spotify gets a link to its app here, and
          YouTube shows its link beside its "Full screen" button. */}
      {service === "spotify" && <OpenInApp service={service} sources={sources} />}
    </div>
  );
}

function Player({ service, sources }: { service: ListenService; sources: ListenSources }) {
  const common = "w-full rounded-xl border-0 bg-transparent";
  const title = `${sources.title} by ${sources.artist} on ${LABELS[service]}`;
  if (service === "apple" && sources.appleMusicUrl) {
    const src = appleMusicEmbedUrl(sources.appleMusicUrl);
    if (!src) return null;
    return (
      <iframe
        key="apple"
        src={src}
        title={title}
        // Apple's own embed settings, without a sandbox: its "Sign In" opens an Apple ID popup,
        // and a sandbox would carry its limits into that popup and can break subscriber sign-in.
        allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write; storage-access *"
        // Apple's most compact layout that still shows everything (see AppleMusicEmbed).
        className={cn(common, "h-[150px] overflow-hidden")}
      />
    );
  }
  if (service === "spotify" && sources.spotifyTrackId) {
    return (
      <iframe
        key="spotify"
        src={`https://open.spotify.com/embed/track/${sources.spotifyTrackId}`}
        title={title}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className={cn(common, "h-[152px]")}
      />
    );
  }
  if (service === "youtube" && sources.youtubeVideoId) {
    return (
      <YouTubeSpace
        key="youtube"
        videoId={sources.youtubeVideoId}
        title={title}
        footer={<OpenInApp service="youtube" sources={sources} />}
      />
    );
  }
  return null;
}

/** Under the player: the same song in that service's app (full songs for its subscribers). */
function OpenInApp({ service, sources }: { service: ListenService; sources: ListenSources }) {
  const query = encodeURIComponent(`${sources.title} ${sources.artist}`);
  const href =
    service === "apple"
      ? sources.appleMusicUrl
      : service === "spotify"
        ? sources.spotifyTrackId
          ? `https://open.spotify.com/track/${sources.spotifyTrackId}`
          : `https://open.spotify.com/search/${query}`
        : sources.youtubeVideoId
          ? `https://music.youtube.com/watch?v=${sources.youtubeVideoId}`
          : `https://music.youtube.com/search?q=${query}`;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground inline-flex items-center justify-self-end gap-1 text-xs"
    >
      Open in {service === "youtube" ? "YouTube Music" : LABELS[service]} <ArrowUpRightIcon className="size-3" />
    </a>
  );
}
