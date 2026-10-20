"use client";

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WALL_COLORS, WALL_THEME_COOKIE, type WallTheme } from "@/lib/wall-theme";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const WallThemeContext = createContext<{
  theme: WallTheme;
  setTheme: (theme: WallTheme) => void;
} | null>(null);

/**
 * A collection wall in its colour, black or white. Everything inside paints with the CSS
 * variables --wall (the background) and --wall-ink (text and controls on it).
 */
export function WallSurface({
  initialTheme,
  className,
  children,
}: {
  initialTheme: WallTheme;
  className?: string;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const colors = WALL_COLORS[theme];

  return (
    <WallThemeContext
      value={{
        theme,
        setTheme: (next) => {
          setTheme(next);
          document.cookie = `${WALL_THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
        },
      }}
    >
      <div
        className={cn("transition-colors duration-500", className)}
        style={{ "--wall": colors.wall, "--wall-ink": colors.ink } as CSSProperties}
      >
        {children}
      </div>
    </WallThemeContext>
  );
}

/** Switches the wall between black and white. */
export function WallThemeToggle({ className }: { className?: string }) {
  const context = useContext(WallThemeContext);
  if (!context) return null;
  const next = context.theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => context.setTheme(next)}
      aria-label={next === "light" ? "White wall" : "Black wall"}
      className={cn(
        "grid size-10 place-items-center rounded-full bg-(--wall-ink)/10 backdrop-blur transition-colors hover:bg-(--wall-ink)/20",
        className,
      )}
    >
      {next === "light" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </button>
  );
}
