"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Loader2Icon, MusicIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  detectStorefront,
  searchSongs,
  SongSearchError,
  type SongSearchResult,
} from "@/lib/apple-music";
import { cn } from "@/lib/utils";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

type Status = "idle" | "loading" | "done" | "rate_limited" | "error";

type SongSearchProps = {
  inputId: string;
  error?: string;
  autoFocus?: boolean;
  onSelect: (song: SongSearchResult) => void;
  onEnterManually: () => void;
};

export function SongSearch({ inputId, error, autoFocus, onSelect, onEnterManually }: SongSearchProps) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongSearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const timer = useRef<number | undefined>(undefined);
  const controller = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, SongSearchResult[]>());
  const storefront = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
      controller.current?.abort();
    };
  }, []);

  function handleInput(value: string) {
    setQuery(value);
    setActiveIndex(-1);
    window.clearTimeout(timer.current);
    controller.current?.abort();

    const term = value.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus("idle");
      setOpen(false);
      return;
    }

    setOpen(true);
    const cached = cache.current.get(term.toLowerCase());
    if (cached) {
      setResults(cached);
      setStatus("done");
      return;
    }

    setStatus("loading");
    timer.current = window.setTimeout(async () => {
      const request = new AbortController();
      controller.current = request;
      storefront.current ??= detectStorefront();
      try {
        const songs = await searchSongs(term, storefront.current, request.signal);
        cache.current.set(term.toLowerCase(), songs);
        setResults(songs);
        setStatus("done");
      } catch (err) {
        if (request.signal.aborted) return;
        setResults([]);
        setStatus(err instanceof SongSearchError && err.reason === "rate_limited" ? "rate_limited" : "error");
      }
    }, DEBOUNCE_MS);
  }

  function select(song: SongSearchResult) {
    setOpen(false);
    onSelect(song);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) {
      // Enter with no list open would submit the whole form.
      if (e.key === "Enter") e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) select(results[activeIndex]);
    }
  }

  const hintId = `${inputId}-hint`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>Song</Label>
      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          id={inputId}
          type="search"
          role="combobox"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="Search by song or artist"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= MIN_QUERY_LENGTH && setOpen(true)}
          onBlur={() => setOpen(false)}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          aria-invalid={!!error}
          aria-describedby={hintId}
          className="bg-background h-11 pl-9"
        />
        {status === "loading" && (
          <Loader2Icon className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        )}

        {open && (
          <div className="bg-popover text-popover-foreground absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border shadow-lg">
            <ul id={listboxId} role="listbox" aria-label="Songs" className="max-h-80 overflow-y-auto py-1">
              {results.map((song, index) => (
                <li
                  key={`${song.trackId}-${song.collectionId}`}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  // mousedown (not click) so the input's blur doesn't close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(song);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2",
                    index === activeIndex && "bg-muted",
                  )}
                >
                  <SongThumb song={song} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{song.title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {song.artist}
                      {song.album && ` · ${song.album}`}
                    </p>
                  </div>
                  {song.year && <span className="text-muted-foreground text-xs tabular-nums">{song.year}</span>}
                </li>
              ))}
            </ul>
            {status !== "done" || results.length === 0 ? (
              <p className="text-muted-foreground px-3 py-3 text-sm">
                {status === "loading" && "Searching…"}
                {status === "done" && `No songs found for “${query.trim()}”.`}
                {status === "rate_limited" && "Too many searches. Wait a moment and try again."}
                {status === "error" && "Search isn’t available right now."}
              </p>
            ) : null}
          </div>
        )}
      </div>
      <div id={hintId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className={error ? "text-destructive" : "text-muted-foreground"}>
          {error ?? "Results from Apple Music."}
        </span>
        <button
          type="button"
          onClick={onEnterManually}
          className="text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Can&apos;t find it? Enter it manually
        </button>
      </div>
    </div>
  );
}

type SelectedSongProps = {
  song: SongSearchResult;
  onChange: () => void;
};

export function SelectedSong({ song, onChange }: SelectedSongProps) {
  return (
    <div className="grid gap-2">
      <Label>Song</Label>
      <div className="bg-background flex items-center gap-3 rounded-xl border p-2.5">
        <SongThumb song={song} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{song.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            {song.artist}
            {song.album && ` · ${song.album}`}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onChange}>
          Change
        </Button>
      </div>
    </div>
  );
}

function SongThumb({ song, size = "sm" }: { song: SongSearchResult; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "size-12" : "size-10";
  if (!song.artworkUrl) {
    return (
      <div className={cn("bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-md", box)}>
        <MusicIcon className="size-4" />
      </div>
    );
  }
  // Artwork is shown only to help pick the right version; it never goes on the card.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={song.artworkUrl} alt="" className={cn("shrink-0 rounded-md object-cover", box)} />;
}
