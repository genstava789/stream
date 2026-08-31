import crypto from 'crypto';

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';

export interface HashResult {
  salt: string;
  hash: string;
}

/**
 * Hashes a plain-text password using PBKDF2 with SHA-512 and a random 16-byte salt.
 */
export function hashPassword(password: string): HashResult {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return { salt, hash };
}

/**
 * Verifies a plain-text password against a stored salt and hash using timing-safe comparison.
 */
export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  if (!password || !salt || !storedHash) return false;
  try {
    const derivedHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derivedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (err) {
    console.error('[auth/password] Verification error:', err);
    return false;
  }
}
