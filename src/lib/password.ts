import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Password hashing on Node's built-in scrypt — no dependency, in the same
// spirit as the hand-written UI primitives. scrypt is memory-hard, so it is a
// sound choice here; the cost parameters below are the Node defaults (N=16384,
// r=8, p=1), which take a few tens of milliseconds per attempt.
//
// Stored format: `scrypt$<salt-b64>$<key-b64>`. The algorithm is named in the
// string so a future change can re-hash on next sign-in instead of locking
// everyone out.

const scryptAsync = promisify(scrypt);

const KEY_BYTES = 64;
const SALT_BYTES = 16;
const PREFIX = "scrypt";

/** Hash a plaintext password for storage. Never log or return the input. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;
  return `${PREFIX}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/**
 * Check a password against a stored digest.
 *
 * Returns false rather than throwing for a null or malformed digest — a Google
 * account has no `passwordHash`, and that is a failed password login, not an
 * error. The comparison is constant-time so a wrong password can't be narrowed
 * down byte by byte.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;

  const [algorithm, saltB64, keyB64] = stored.split("$");
  if (algorithm !== PREFIX || !saltB64 || !keyB64) return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  if (expected.length !== KEY_BYTES) return false;

  const actual = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;
  return timingSafeEqual(actual, expected);
}

/**
 * Burn roughly the same time as a real verification, for when no account
 * matched. Without it, "unknown username" would answer noticeably faster than
 * "wrong password" and the login form would become a way to discover who has
 * an account.
 */
export async function fakeVerifyDelay(): Promise<void> {
  await scryptAsync("", randomBytes(SALT_BYTES), KEY_BYTES);
}
