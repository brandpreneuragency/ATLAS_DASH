// Argon2id password hashing. Uses `@node-rs/argon2` (prebuilt NAPI binaries,
// no native compilation needed on the user's Windows dev machine or on the
// Linux VPS).
//
// We deliberately pick OWASP-recommended cost parameters for an interactive
// server. Tune these if the VPS CPU is too slow to log in.

import { hash, verify, Algorithm } from '@node-rs/argon2';

const HASH_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}
