import { MAX_EDITION_SIZE } from "@/lib/validation";

/** Petrichor's public contact address, set with NEXT_PUBLIC_CONTACT_EMAIL. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

/** A mailto link for requesting an edition larger than senders can create themselves. */
export function largeEditionMailto(): string | null {
  if (!CONTACT_EMAIL) return null;
  const subject = `Edition of more than ${MAX_EDITION_SIZE} cards`;
  const body = "Hi Petrichor,\n\nI'd like to create an edition of ___ cards.\n\nSong:\nOccasion:\n";
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
