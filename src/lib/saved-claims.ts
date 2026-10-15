// Claim codes for cards made "For myself" while signed out, kept in this browser
// until the person signs in and /keepsakes claims them. Browser storage only.

const KEY = "petrichor:saved-claims";

export type SavedClaim = { cardId: string; token: string };

export function readSavedClaims(): SavedClaim[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((c) => typeof c?.cardId === "string" && typeof c?.token === "string") : [];
  } catch {
    return [];
  }
}

export function saveClaims(claims: SavedClaim[]) {
  try {
    const merged = [...readSavedClaims(), ...claims].filter(
      (c, i, all) => all.findIndex((o) => o.cardId === c.cardId) === i,
    );
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // Storage unavailable (private mode); the claim links shown after creating still work.
  }
}

export function forgetClaims(cardIds: string[]) {
  try {
    const remaining = readSavedClaims().filter((c) => !cardIds.includes(c.cardId));
    if (remaining.length) localStorage.setItem(KEY, JSON.stringify(remaining));
    else localStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
