// Invite codes. Raw code is returned ONCE on creation, then we store only its
// SHA-256 hash. Comparison on registration is constant-time on the hash side,
// and the alphabet excludes visually ambiguous characters (0/O, 1/I/L).
//
// Format: TABS-XXXXX-XXXXX  (10 chars in two groups of 5, plus the TABS- prefix).

import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no 0/1/I/L/O
const GROUP_SIZE = 5;
const GROUP_COUNT = 2;

function randomChars(count: number): string {
  const bytes = crypto.randomBytes(count);
  let out = '';
  for (let i = 0; i < count; i++) {
    const byte = bytes[i] ?? 0;
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

export function generateInviteCode(): { code: string; codeHash: string } {
  const groups: string[] = [];
  for (let i = 0; i < GROUP_COUNT; i++) {
    groups.push(randomChars(GROUP_SIZE));
  }
  const code = `TABS-${groups.join('-')}`;
  return { code, codeHash: hashInviteCode(code) };
}

export function hashInviteCode(code: string): string {
  // Normalise: uppercase, strip surrounding whitespace, single space.
  const normalised = code.trim().toUpperCase();
  return crypto.createHash('sha256').update(normalised).digest('hex');
}

export function isWellFormedInviteCode(code: string): boolean {
  if (code.length > 80) return false;
  const normalised = code.trim().toUpperCase();
  if (!normalised.startsWith('TABS-')) return false;
  const rest = normalised.slice('TABS-'.length);
  const parts = rest.split('-');
  if (parts.length !== GROUP_COUNT) return false;
  return parts.every((p) => p.length === GROUP_SIZE && /^[A-Z2-9]+$/.test(p));
}
