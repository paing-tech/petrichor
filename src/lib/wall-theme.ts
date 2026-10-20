// Shared by the collection page (server) and its toggle (client); keep free of server-only imports.

export type WallTheme = "dark" | "light";

/** Remembers the wall's colour, so a collection opens in it straight away. */
export const WALL_THEME_COOKIE = "petrichor-wall";

/**
 * A collection wall's colours: the wall itself, and the ink for everything on it (text,
 * buttons, the frame around an opened photo).
 */
export const WALL_COLORS: Record<WallTheme, { wall: string; ink: string }> = {
  dark: { wall: "#000000", ink: "#FFFFFF" },
  light: { wall: "#FFFFFF", ink: "#000000" },
};

export function parseWallTheme(value: string | undefined): WallTheme {
  return value === "light" ? "light" : "dark";
}
