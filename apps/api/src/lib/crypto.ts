/**
 * Cryptography Utilities
 * AES-256-GCM encryption for sensitive data (API keys, tokens)
 *
 * Format: iv:authTag:encryptedData (all hex-encoded)
 * Example: "a1b2c3d4...12:e5f6g7h8...12:9i0j1k2l...48"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a 32-byte encryption key from the master key
 * Uses the first 32 bytes of SHA-256 hash
 */
function deriveKey(masterKey: string): Buffer {
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(masterKey).digest();
}

/**
 * Encrypts an API key or other sensitive plaintext
 *
 * @param plaintext - The sensitive data to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedData (hex-encoded)
 * @throws Error if encryption fails
 *
 * @example
 * const encrypted = encryptApiKey('sk-1234567890abcdef');
 * // Returns: "a1b2c3d4...12:e5f6g7h8...12:9i0j1k2l...48"
 */
export function encryptApiKey(plaintext: string): string {
  try {
    const key = deriveKey(env.MASTER_ENCRYPTION_KEY);
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData (all hex-encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypts an encrypted API key
 *
 * @param encrypted - Encrypted string in format: iv:authTag:encryptedData (hex-encoded)
 * @returns Decrypted plaintext
 * @throws Error if decryption fails or format is invalid
 *
 * @example
 * const decrypted = decryptApiKey('a1b2c3d4...12:e5f6g7h8...12:9i0j1k2l...48');
 * // Returns: "sk-1234567890abcdef"
 */
export function decryptApiKey(encrypted: string): string {
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format: expected iv:authTag:encryptedData');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = deriveKey(env.MASTER_ENCRYPTION_KEY);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedData = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Validates that an encrypted string has the correct format
 *
 * @param encrypted - String to validate
 * @returns true if format is valid
 */
export function isValidEncryptedFormat(encrypted: string): boolean {
  const parts = encrypted.split(':');
  if (parts.length !== 3) return false;

  const [ivHex, authTagHex, encryptedHex] = parts;

  // Check hex format and lengths
  const hexPattern = /^[0-9a-f]+$/i;
  return (
    hexPattern.test(ivHex) &&
    hexPattern.test(authTagHex) &&
    hexPattern.test(encryptedHex) &&
    ivHex.length === IV_LENGTH * 2 && // 16 bytes = 32 hex chars
    authTagHex.length === AUTH_TAG_LENGTH * 2 // 16 bytes = 32 hex chars
  );
}
