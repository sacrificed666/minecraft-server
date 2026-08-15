/**
 * Client-side password generation, so a new one appears the moment it is asked
 * for instead of after a round trip.
 *
 * The alphabet mirrors lib/users.ts deliberately rather than importing it:
 * that module pulls in node:crypto and would drag the server runtime into the
 * browser bundle. Readable, with no character that can be misread aloud.
 */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePassword(length = 14): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
