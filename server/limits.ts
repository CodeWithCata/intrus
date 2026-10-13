/** Message size limits, measured in real UTF-8 bytes (not UTF-16 characters). */

export const MAX_MSG_BYTES = 8 * 1024;
/** Only a "settings" message may be this large (it carries the host's own word list). */
export const MAX_CUSTOM_MSG_BYTES = 16 * 1024;

const encoder = new TextEncoder();

export const byteLength = (text: string): number => encoder.encode(text).length;

/** True when `raw` is too big for a message of `type` (type unknown yet = the larger limit). */
export function exceedsLimit(raw: string, type?: string): boolean {
  const limit = type === undefined || type === "settings" ? MAX_CUSTOM_MSG_BYTES : MAX_MSG_BYTES;
  // A string of N characters is at most 3N bytes: only count bytes when the cheap check cannot decide.
  if (raw.length * 3 <= limit) return false;
  return byteLength(raw) > limit;
}
