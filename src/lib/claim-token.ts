import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Claim codes are 256-bit secrets carried only in claim links (?k=…). The database
 * stores their SHA-256, so a leaked database row can't be used to claim a card.
 */
export const CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateClaimToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashClaimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
