/** Where to send someone who needs to sign in: the sign-in page, which returns to `next` afterwards. */
export function signInPath(next: string) {
  return `/sign-in?next=${encodeURIComponent(next)}`;
}
