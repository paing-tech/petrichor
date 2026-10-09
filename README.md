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

1. `/create` validates the form against the same Zod schemas the server uses ([src/lib/validation.ts](src/lib/validation.ts)) and shows a live `CollectibleCard` preview.
2. **Preview card** opens a review step. Nothing is uploaded or saved until the sender clicks **Create card**.
3. On confirm, if there is a photo:
   - The `requestPhotoUpload` server action checks the file's type and size, then returns a presigned R2 `PUT` URL that expires in 5 minutes. The URL signs `Content-Type` and `Content-Length`, so R2 rejects any other type or size.
   - The browser uploads the photo straight to R2. This avoids serverless request-size limits.
4. The `createCard` server action:
   - re-validates every field;
   - reads the uploaded object's size and first bytes to confirm it is really a JPEG, PNG or WebP of 5 MB or less, and deletes it otherwise;
   - generates the card ID and inserts the row.
5. The sender gets a shareable link to `/c/{cardId}`.
6. `/c/[cardId]` serves a prerendered shell and streams the card in. Cards are immutable, so lookups are cached indefinitely (`"use cache"` + `cacheLife("max")`). Card pages are marked `noindex`.

### Card IDs

`P-` followed by 26 Crockford base32 characters encoding 128 bits from `crypto.randomBytes` ([src/lib/card-id.ts](src/lib/card-id.ts)). The ID is stored in a `UNIQUE` column, separate from the UUID primary key, which is never exposed. No code path updates a card.

### `CollectibleCard`

[src/components/collectible-card.tsx](src/components/collectible-card.tsx) is designed on a 390 × 520 canvas:

- The photo area is 390 × 293 and fades into white.
- A vinyl disc sits in the bottom-right corner.

Every measurement is written in canvas pixels and converted with container-query units, so the card scales to any width with the same layout. The view page and the create flow share the component.

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
- **No moderation or reporting** for shared content.
