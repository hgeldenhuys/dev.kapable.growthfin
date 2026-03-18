/**
 * Encryption utilities for control plane secrets
 *
 * Uses pgcrypto's pgp_sym_encrypt/decrypt for passwords stored in DB
 */

import { sql } from './db';
import { requireEnv } from './require-env';

const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');

/**
 * Decrypt a value encrypted with pgp_sym_encrypt
 */
export async function decrypt(encryptedValue: string): Promise<string> {
  const result = await sql`
    SELECT pgp_sym_decrypt(${encryptedValue}::bytea, ${ENCRYPTION_KEY}) as decrypted
  `;
  return result[0].decrypted;
}

/**
 * Encrypt a value with pgp_sym_encrypt
 */
export async function encrypt(value: string): Promise<string> {
  const result = await sql`
    SELECT pgp_sym_encrypt(${value}, ${ENCRYPTION_KEY}) as encrypted
  `;
  return result[0].encrypted;
}
