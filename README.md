# Petrichor

Create and share digital music memory cards. No accounts: a sender builds a card at `/create`, and anyone with the link (`/c/P-…`) can view it.

**Stack:** Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Neon Postgres + Drizzle ORM, Zod, Cloudflare R2 for photos.

## Setup

### 1. Install

```sh
npm install
cp .env.example .env.local
```

### 2. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech) and copy the **pooled** connection string into `DATABASE_URL`.
2. Create the `cards` table:

   ```sh
   npm run db:migrate
   ```

When you change [src/db/schema.ts](src/db/schema.ts), run `npm run db:generate` to write a new migration to `drizzle/`, then `npm run db:migrate`.

### 3. Photo storage (Cloudflare R2)

1. Create a bucket (for example `petrichor-photos`) and set `R2_BUCKET_NAME`.
2. **Settings → Public access:** enable the r2.dev subdomain (or connect a custom domain) and set `R2_PUBLIC_URL`.
3. **Manage API tokens:** create a token with *Object Read & Write* scoped to the bucket. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
4. **Settings → CORS policy:** browsers upload directly to R2, so allow `PUT` from your app's origins:

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

### 4. Run

```sh
npm run dev
```

Open http://localhost:3000.

## How it works

**Create → Preview → Save → Share → View**

1. `/create` starts with a song search (see [Song search](#song-search)), then validates the form against the same Zod schemas the server uses ([src/lib/validation.ts](src/lib/validation.ts)) and shows a live `CollectibleCard` preview.
2. **Preview card** opens a review step. Nothing is uploaded or saved until the sender clicks **Create card**.
3. On confirm, if there is a photo:
   - Senders can pick a photo of any size, in any format their browser can open. The original never leaves the device.
   - The browser crops it to exactly what the sender framed in the photo editor ([src/lib/photo-crop.ts](src/lib/photo-crop.ts)). The editor supports drag, zoom from 1× to 3×, pinch and arrow keys.
   - The crop is exported as a JPEG at most 2560px wide (6.5× the card's photo area, enough for saving as an image or a 300 dpi print, and never enlarged) at 92% quality. Exports are typically 1–3 MB. If a very detailed photo would exceed the 10 MB upload cap, it's re-encoded at slightly lower quality. Re-encoding also strips EXIF metadata such as GPS location.
   - The `requestPhotoUpload` server action checks the file's type and size, then returns a presigned R2 `PUT` URL that expires in 5 minutes. The URL signs `Content-Type` and `Content-Length`, so R2 rejects any other type or size.
   - The browser uploads the photo straight to R2. This avoids serverless request-size limits.
4. The `createCard` server action:
   - re-validates every field;
   - reads the uploaded object's size and first bytes to confirm it is really a JPEG, PNG or WebP of 10 MB or less, and deletes it otherwise;
   - builds the Apple Music link from the selected song's IDs;
   - generates the card ID and inserts the row.
5. The sender gets a shareable link to `/c/{cardId}`.
6. `/c/[cardId]` serves a prerendered shell and streams the card in, followed by Apple Music's embedded player and a "Find on Spotify" link. Cards are immutable, so lookups are cached indefinitely (`"use cache"` + `cacheLife("max")`). Card pages are marked `noindex`.

### Song search

Senders search instead of typing the title and artist ([src/components/create/song-search.tsx](src/components/create/song-search.tsx)):

- **Source:** Apple's [iTunes Search API](https://performance-partners.apple.com/search-api). It needs no key and allows browser requests from any origin, so it's called straight from the visitor's browser. Its limit of about 20 requests/minute is per IP, so each visitor has their own allowance. Searches are debounced and cached per query.
- **Catalog country:** taken from the browser's locale, with the US catalog as the fallback.
- **Choosing a song** fills in the title and artist and shows Apple Music's official embedded player, which plays a 30-second preview.
- **Songs not in the catalog:** "Enter it manually" falls back to plain text fields. Those cards get "Find on Apple Music / Spotify" search links instead of a player.
- **What's stored:** only the track and album IDs are sent to the server. The server builds the canonical `https://music.apple.com/{storefront}/album/{albumId}?i={trackId}` URL itself, so a client can't inject an arbitrary link into the player.
- **No album artwork on cards:** cards are Petrichor collectibles, so artwork is never stored or put on a card. It appears only as thumbnails in the search results and inside Apple's own player.
- **Why there's no Spotify player:** Spotify's Web API locks down new apps (5-user development mode, no preview clips), and the public song.link conversion API has been shut down. Cards link to a Spotify search instead.

### Editions

A sender can create up to 20 numbered copies of one card ("Copies" on `/create`). For more, the form links to "Contact us" (`NEXT_PUBLIC_CONTACT_EMAIL`). Each copy has the same content but its own card ID and link, and prints as "1 of 3", "2 of 3", "3 of 3":

- `edition_number` / `edition_size` hold the numbering; `edition_id` links the copies of one set.
- All copies are inserted in a single statement, so a set is saved completely or not at all. A photo is uploaded once and shared by every copy.
- The database enforces the rules itself: `edition_size` is between 1 and 20 (the same as `MAX_EDITION_SIZE`), `edition_number` is between 1 and `edition_size`, and numbers are unique within a set.
- After saving, the sender gets a list of every copy's link, with "Copy all links".

### Card IDs

`P-` followed by 26 Crockford base32 characters encoding 128 bits from `crypto.randomBytes` ([src/lib/card-id.ts](src/lib/card-id.ts)). The ID is stored in a `UNIQUE` column, separate from the UUID primary key, which is never exposed. No code path updates a card.

### `CollectibleCard`

[src/components/collectible-card.tsx](src/components/collectible-card.tsx) is designed on a 390 × 520 canvas:

- **Top:** a 390 × 293 photo that fades into the card color. The optional moment (an occasion or place, e.g. "Birthday party" or "Singapore") sits on the right, centered on the fade's third stop.
- **Middle:** the handwritten message, with the sender's signature right-aligned beneath it.
- **Bottom:** song title, artist, lyrics, "1 of 1" with the creation date, and the card ID centered below them.

Every measurement is written in canvas pixels and converted with container-query units, so the card scales to any width with the same layout. Titles up to 26 characters take one line, at 31px or 26px, and leave the message three lines. Longer titles wrap to two 21px lines, and the message gets two. Text never overflows the card.

**Card color.** Senders pick the card's base color: White (the default), Black, up to four colors from their photo, or any color from the native picker. Photo colors are taken in the browser ([src/lib/photo-palette.ts](src/lib/photo-palette.ts)): the photo is downscaled to 64 × 64, pixels are grouped into similar colors, and the most common distinct ones are kept, skipping near-white and near-black. The photo's bottom fade blends into the chosen color. Text is white on dark colors and near-black on light ones, whichever contrasts more ([src/lib/card-color.ts](src/lib/card-color.ts)). The color is stored as `#rrggbb` in `card_color`.

**Photo area color.** When a card has no photo, the sender can choose what fills the photo area: Earth (the default sage gradient), White, Black, or a custom color. It's stored in `photo_area_color`, where NULL means the Earth gradient. It's ignored when the card has a photo.

| Typeface | Used for |
| --- | --- |
| Instrument Serif | Song title |
| Kalam Light | Personal message |
| Cormorant Garamond Italic | Lyrics, sender's signature |
| Outfit | Artist, moment, date, "1 of 1", card ID |

All four are Google Fonts under the SIL Open Font License, loaded with `next/font` in [src/app/layout.tsx](src/app/layout.tsx).

## Scripts

| Script | |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Browse data with Drizzle Studio |

## Known gaps (post-MVP)

- **Orphaned photos:** a photo uploaded for a card that then fails to save stays in R2. Add an R2 lifecycle rule or a cleanup job.
- **No rate limiting** on card creation or upload URLs. Add it before a public launch (for example with Upstash or Cloudflare).
- **No moderation or reporting** for shared content. Card lookups are cached indefinitely, so a moderation tool that deletes a card must also call ``revalidateTag(`card:${cardId}`)``.
