import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
// ENCRYPTION_KEY must be a 32-byte hex string defined in .env
const keyHex = process.env.ENCRYPTION_KEY;
if (!keyHex) {
  throw new Error('ENCRYPTION_KEY is not set in environment');
}
const key = Buffer.from(keyHex, 'hex');

/**
 * Encrypt a plain text string.
 * Returns a payload string formatted as `${iv}.${cipher}.${authTag}` in hex.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12); // 96‑bit IV for GCM
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${encrypted.toString('hex')}.${authTag.toString('hex')}`;
}

/**
 * Decrypt a payload produced by `encrypt`.
 */
export function decrypt(payload: string): string {
  const [ivHex, encryptedHex, authTagHex] = payload.split('.');
  if (!ivHex || !encryptedHex || !authTagHex) {
    throw new Error('Invalid encrypted payload format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
