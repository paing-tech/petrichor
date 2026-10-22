"use server";

import { z } from "zod";
import { buildAppleMusicUrl } from "@/lib/apple-music";
import { getAccount } from "@/lib/auth/account";
import { insertEdition, type CopyPlan } from "@/lib/cards";
import { getMusicMatchEnv } from "@/lib/env";
import { getSearchableProfiles, searchProfiles, type PublicProfile } from "@/lib/profiles";
import { getSongMatches, lookUpYouTubeVideo } from "@/lib/song-matching";
import { createPhotoUploadUrl, getPhotoPublicUrl, verifyUploadedPhoto } from "@/lib/storage";
import {
  appleMusicTrackSchema,
  createCardSchema,
  fieldErrors,
  LIMITS,
  photoUploadRequestSchema,
  type CardFieldErrors,
  type CreateCardInput,
} from "@/lib/validation";
import { parseYouTubeVideoId } from "@/lib/youtube-link";

type ActionFailure = {
  ok: false;
  error: string;
  code?: "photo_invalid" | "needs_profile";
  fieldErrors?: CardFieldErrors;
};

type ActionResult<T> = ({ ok: true } & T) | ActionFailure;

export async function requestPhotoUpload(input: {
  contentType: string;
  size: number;
}): Promise<ActionResult<{ key: string; uploadUrl: string }>> {
  const parsed = photoUploadRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    const { key, uploadUrl } = await createPhotoUploadUrl(parsed.data.contentType, parsed.data.size);
    return { ok: true, key, uploadUrl };
  } catch (error) {
    console.error("Failed to presign photo upload", error);
    return { ok: false, error: "Photo uploads are unavailable right now. Please try again." };
  }
}

export type CreatedCopyResult = {
  cardId: string;
  editionNumber: number;
  /** Secret claim code, only for copies that are kept through a claim link. */
  claimToken: string | null;
  /** Set when this copy was sent straight to an account. */
  recipient: PublicProfile | null;
  /** True when the signed-in creator owns this copy already. */
  ownedByYou: boolean;
};

/** Creates a card, or a numbered edition of identical cards, with each copy's ownership. */
export async function createCard(input: CreateCardInput): Promise<ActionResult<{ copies: CreatedCopyResult[] }>> {
  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  const {
    photoKey,
    appleMusic,
    timeZone,
    cardColor,
    photoAreaColor,
    editionSize,
    audience,
    anonymous,
    recipientUserIds,
    youtubeVideoId,
    ...fields
  } = parsed.data;

  try {
    const account = await getAccount();

    // Work out how each copy starts: owned by you, sent to an account, or claimable.
    let copies: CopyPlan[];
    let recipients: PublicProfile[] = [];
    if (audience === "self") {
      if (account && !account.profile) {
        return { ok: false, code: "needs_profile", error: "Choose a username before keeping cards." };
      }
      copies = Array.from({ length: editionSize }, () =>
        account ? { kind: "owned" as const, ownerUserId: account.user.id } : { kind: "claimable" as const },
      );
    } else {
      const uniqueIds = [...new Set(recipientUserIds)];
      // Signed-out senders can send to accounts too; if such a copy is declined there's
      // no account to re-issue it from, so it simply stays unkept.
      if (uniqueIds.length > 0) {
        if (uniqueIds.length > editionSize) {
          return { ok: false, error: `You picked more recipients than copies (${editionSize}).` };
        }
        if (account && uniqueIds.includes(account.user.id)) {
          return { ok: false, error: "To keep a copy yourself, choose “For myself”." };
        }
        // Only accounts that can be found in search can receive cards directly.
        const found = await getSearchableProfiles(uniqueIds);
        const byId = new Map(found.map((p) => [p.userId, p]));
        if (byId.size !== uniqueIds.length) {
          return { ok: false, error: "One of the recipients can't receive cards right now. Remove them and try again." };
        }
        recipients = uniqueIds.map((id) => byId.get(id)!);
      }
      copies = Array.from({ length: editionSize }, (_, i) =>
        recipients[i] ? { kind: "delivered" as const, recipientUserId: recipients[i].userId } : { kind: "claimable" as const },
      );
    }

    // The creator's YouTube pick is checked again: it must exist and play outside YouTube.
    if (youtubeVideoId) {
      const video = await lookUpYouTubeVideo(youtubeVideoId, fields.songTitle).catch(() => null);
      if (!video?.embeddable) {
        return { ok: false, error: "The YouTube video you picked can't be played here. Remove it or pick another." };
      }
    }

    if (photoKey && !(await verifyUploadedPhoto(photoKey))) {
      return {
        ok: false,
        code: "photo_invalid",
        error: "The photo upload could not be verified. Please choose the photo again.",
      };
    }

    const created = await insertEdition(
      {
        ...fields,
        senderName: anonymous ? null : fields.senderName,
        photoUrl: photoKey ? getPhotoPublicUrl(photoKey) : null,
        appleMusicUrl: appleMusic ? buildAppleMusicUrl(appleMusic) : null,
        timeZone,
        cardColor,
        // The photo area color only applies to cards without a photo.
        photoAreaColor: photoKey ? null : photoAreaColor,
        youtubeVideoId: youtubeVideoId ?? null,
      },
      { creatorUserId: account?.user.id ?? null, copies },
    );

    return {
      ok: true,
      copies: created.map((copy, i) => ({
        ...copy,
        recipient: recipients[i] ?? null,
        ownedByYou: copies[i].kind === "owned",
      })),
    };
  } catch (error) {
    console.error("Failed to create card", error);
    return { ok: false, error: "We couldn't save your card. Please try again." };
  }
}

/**
 * Recipient search for "For someone", open to signed-out senders too. Returns only
 * public fields of accounts that allow being found, at most 8 at a time.
 */
export async function searchRecipients(query: string): Promise<PublicProfile[]> {
  if (typeof query !== "string" || query.length > 50) return [];
  const account = await getAccount();
  return searchProfiles(query, account?.user.id ?? null);
}

const songSchema = z.object({
  songTitle: z.string().trim().min(1).max(LIMITS.songTitle),
  artistName: z.string().trim().min(1).max(LIMITS.artistName),
  appleMusic: appleMusicTrackSchema.nullable(),
});

/**
 * Whether the song can play from YouTube on its card page, for the preview: "found" (a match
 * is stored for it), "missing" (the creator can paste a link instead), or "unavailable" (YouTube
 * isn't set up, so there's nothing to offer). Looking it up here also saves the card page the wait.
 */
export async function checkYouTubeMatch(
  input: z.input<typeof songSchema>,
): Promise<"found" | "missing" | "unavailable"> {
  const parsed = songSchema.safeParse(input);
  if (!parsed.success || !getMusicMatchEnv().youtubeApiKey) return "unavailable";
  const { songTitle, artistName, appleMusic } = parsed.data;
  const { youtubeVideoId } = await getSongMatches({
    title: songTitle,
    artist: artistName,
    appleMusicUrl: appleMusic ? buildAppleMusicUrl(appleMusic) : null,
  });
  return youtubeVideoId ? "found" : "missing";
}

export type PickedYouTubeVideo = {
  videoId: string;
  title: string;
  channel: string;
  /** False when the video's title doesn't name the song: worth a second look. */
  namesSong: boolean;
};

/** Checks a YouTube link the creator pasted for a song that wasn't found on YouTube. */
export async function checkYouTubeLink(input: {
  url: string;
  songTitle: string;
}): Promise<ActionResult<{ video: PickedYouTubeVideo }>> {
  const videoId = typeof input.url === "string" && input.url.length <= 500 ? parseYouTubeVideoId(input.url) : null;
  if (!videoId) return { ok: false, error: "That doesn't look like a YouTube video link." };
  const songTitle = typeof input.songTitle === "string" ? input.songTitle.slice(0, LIMITS.songTitle) : "";
  try {
    const video = await lookUpYouTubeVideo(videoId, songTitle);
    if (!video) return { ok: false, error: "We couldn't find that video. Is it public?" };
    if (!video.embeddable) {
      return { ok: false, error: "That video can only be played on YouTube. Try another upload of the song." };
    }
    return { ok: true, video: { videoId, title: video.title, channel: video.channel, namesSong: video.namesSong } };
  } catch (error) {
    console.error("YouTube link check failed", error);
    return { ok: false, error: "We couldn't check that link right now. Please try again." };
  }
}
