import "server-only";
import { randomBytes } from "node:crypto";

// Crockford base32: no I, L, O or U, so IDs are unambiguous when read aloud or retyped.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RANDOM_BYTES = 16; // 128 bits
const ENCODED_LENGTH = 26; // ceil(128 / 5)

/** Generates a public card ID like `P-0Q8Z3K…` carrying 128 bits of CSPRNG randomness. */
export function generateCardId(): string {
  let value = BigInt(`0x${randomBytes(RANDOM_BYTES).toString("hex")}`);
  let encoded = "";
  for (let i = 0; i < ENCODED_LENGTH; i++) {
    encoded = ALPHABET[Number(value & BigInt(31))] + encoded;
    value >>= BigInt(5);
  }
  return `P-${encoded}`;
}
