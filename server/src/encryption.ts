// AES-256-GCM encryption for sensitive at-rest values (currently: provider
// API keys in provider_configs.apiKey). The key is loaded from the
// ENCRYPTION_KEY env var (32 bytes hex).
//
// Wire format: [12 bytes IV][16 bytes auth tag][ciphertext], base64-encoded.
// The auth tag is verified on decrypt, so any tampering throws.

import crypto from 'node:crypto';
import { config } from './config.js';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, the GCM default
const TAG_LENGTH = 16;

function getKey(): Buffer {
  if (!config.encryptionKey) {
    throw new Error('ENCRYPTION_KEY is not configured');
  }
  const buf = Buffer.from(config.encryptionKey, 'hex');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to 32 bytes');
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  if (plaintext === '') return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(ciphertext: string): string {
  if (ciphertext === '') return '';
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Ciphertext is too short');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const enc = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
