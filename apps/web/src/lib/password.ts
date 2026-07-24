import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const ALGORITHM = "scrypt";
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 32;
const MAX_MEMORY = 32 * 1024 * 1024;

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

/** Create a self-contained scrypt password hash for AUTH_PASSWORD_HASH. */
export function createPasswordHash(password: string): string {
  if (!password) throw new Error("Password must not be empty");
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });
  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    encode(salt),
    encode(derivedKey),
  ].join(":");
}

/** Verify an AUTH_PASSWORD_HASH value without exposing timing-sensitive equality. */
export function verifyPassword(password: string, encodedHash: string): boolean {
  try {
    const [algorithm, cost, blockSize, parallelization, saltValue, hashValue] =
      encodedHash.split(":");
    if (
      algorithm !== ALGORITHM ||
      !cost ||
      !blockSize ||
      !parallelization ||
      !saltValue ||
      !hashValue
    ) {
      return false;
    }

    const salt = decode(saltValue);
    const expected = decode(hashValue);
    if (salt.length === 0 || expected.length === 0) return false;

    const actual = scryptSync(password, salt, expected.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
      maxmem: MAX_MEMORY,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}