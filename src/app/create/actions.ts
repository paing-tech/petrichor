"use server";

import { buildAppleMusicUrl } from "@/lib/apple-music";
import { getAccount } from "@/lib/auth/account";
import { insertEdition, type CopyPlan } from "@/lib/cards";
import { getSearchableProfiles, searchProfiles, type PublicProfile } from "@/lib/profiles";
import { createPhotoUploadUrl, getPhotoPublicUrl, verifyUploadedPhoto } from "@/lib/storage";
import {
  createCardSchema,
  fieldErrors,
  photoUploadRequestSchema,
  type CardFieldErrors,
  type CreateCardInput,
} from "@/lib/validation";

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
      if (uniqueIds.length > 0) {
        if (!account) return { ok: false, error: "Sign in to send a card straight to someone's account." };
        if (uniqueIds.length > editionSize) {
          return { ok: false, error: `You picked more recipients than copies (${editionSize}).` };
        }
        if (uniqueIds.includes(account.user.id)) {
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

/** Recipient search for "For someone". Signed-in senders only, so accounts can't be listed anonymously. */
export async function searchRecipients(query: string): Promise<PublicProfile[]> {
  const account = await getAccount();
  if (!account || typeof query !== "string" || query.length > 50) return [];
  return searchProfiles(query, account.user.id);
}
