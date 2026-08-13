/**
 * UUIDv7 — a time-sortable UUID.
 *
 * Layout (RFC 9562): 48-bit big-endian unix millisecond timestamp, 4-bit
 * version, 12 bits of randomness, 2-bit variant, 62 more bits of randomness.
 *
 * Sorting by id therefore sorts by creation time, which keeps inserts local in
 * the B-tree index instead of scattering them the way UUIDv4 does.
 */
export function uuidv7(): string {
  const ts = Date.now();
  const bytes = new Uint8Array(16);

  // 48-bit timestamp, big-endian. Date.now() exceeds 2^32, so bit-shifts would
  // truncate — divide instead.
  bytes[0] = Math.floor(ts / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ts / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ts / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ts / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;

  crypto.getRandomValues(bytes.subarray(6));

  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/** A short, unambiguous invite code — no 0/O/1/I/L to avoid transcription errors. */
export function inviteCode(length = 10): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
