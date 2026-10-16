/**
 * Where to send someone who needs to sign in: the home page, which opens its sign-in
 * form when `next` is present and returns to `next` afterwards.
 */
export function signInPath(next: string) {
  return `/?next=${encodeURIComponent(next)}`;
}
