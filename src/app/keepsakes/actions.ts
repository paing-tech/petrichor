"use server";

import { z } from "zod";
import { getAccount } from "@/lib/auth/account";
import { CLAIM_TOKEN_PATTERN } from "@/lib/claim-token";
import { acceptDelivery, claimCard, declineDelivery, reissueClaimLink } from "@/lib/ownership";
import { CARD_ID_PATTERN } from "@/lib/validation";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: "sign_in" | "needs_profile" };

type Failure = Extract<Result, { ok: false }>;

/** Ownership changes need a signed-in account with a public profile (owners are shown by name). */
async function requireOwnerAccount(): Promise<{ userId: string } | { error: Failure }> {
  const account = await getAccount();
  if (!account) return { error: { ok: false, code: "sign_in", error: "Sign in to keep cards." } };
  if (!account.profile) return { error: { ok: false, code: "needs_profile", error: "Choose a username first." } };
  return { userId: account.user.id };
}

const claimSchema = z.object({
  cardId: z.string().regex(CARD_ID_PATTERN),
  token: z.string().regex(CLAIM_TOKEN_PATTERN),
});

export async function claimCardAction(input: { cardId: string; token: string }): Promise<Result> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "This link can't be used to keep the card." };
  const auth = await requireOwnerAccount();
  if ("error" in auth) return auth.error;
  const claimed = await claimCard(parsed.data.cardId, parsed.data.token, auth.userId);
  return claimed ? { ok: true } : { ok: false, error: "This card has already been kept, or the link has been replaced." };
}

/** Claims cards whose links were saved in this browser while signed out ("For myself"). */
export async function claimSavedCardsAction(items: { cardId: string; token: string }[]): Promise<Result<{ claimed: string[] }>> {
  const parsed = z.array(claimSchema).max(20).safeParse(items);
  if (!parsed.success) return { ok: false, error: "Some saved cards couldn't be read." };
  const auth = await requireOwnerAccount();
  if ("error" in auth) return auth.error;
  const claimed: string[] = [];
  for (const { cardId, token } of parsed.data) {
    if (await claimCard(cardId, token, auth.userId)) claimed.push(cardId);
  }
  return { ok: true, claimed };
}

const idSchema = z.uuid();

export async function acceptDeliveryAction(deliveryId: string): Promise<Result> {
  if (!idSchema.safeParse(deliveryId).success) return { ok: false, error: "Not found." };
  const auth = await requireOwnerAccount();
  if ("error" in auth) return auth.error;
  return (await acceptDelivery(deliveryId, auth.userId))
    ? { ok: true }
    : { ok: false, error: "This card is no longer waiting for you." };
}

export async function declineDeliveryAction(deliveryId: string): Promise<Result> {
  if (!idSchema.safeParse(deliveryId).success) return { ok: false, error: "Not found." };
  const account = await getAccount();
  if (!account) return { ok: false, code: "sign_in", error: "Sign in first." };
  return (await declineDelivery(deliveryId, account.user.id))
    ? { ok: true }
    : { ok: false, error: "This card is no longer waiting for you." };
}

/** A new claim link for an unowned copy you created; the previous link stops working. */
export async function reissueClaimLinkAction(cardId: string): Promise<Result<{ token: string }>> {
  if (!CARD_ID_PATTERN.test(cardId)) return { ok: false, error: "Not found." };
  const account = await getAccount();
  if (!account) return { ok: false, code: "sign_in", error: "Sign in first." };
  const token = await reissueClaimLink(cardId, account.user.id);
  return token ? { ok: true, token } : { ok: false, error: "This card can't get a new link right now." };
}
