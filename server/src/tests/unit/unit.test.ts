// Pure-function tests. No DB required. Run via `npm run server:test` along
// with the integration tests; vitest picks up both.

import { describe, expect, it } from 'vitest';
import { encrypt, decrypt } from '../../encryption.js';
import { generateInviteCode, hashInviteCode, isWellFormedInviteCode } from '../../auth/invite.js';
import { generateSessionToken, hashSessionToken } from '../../auth/session.js';
import { resolveStoragePath, sanitizeFilename } from '../../services/fileStorage.js';

describe('encryption', () => {
  it('round-trips a string', () => {
    const enc = encrypt('hello world');
    expect(enc).not.toBe('hello world');
    expect(decrypt(enc)).toBe('hello world');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encrypt('same input');
    const b = encrypt('same input');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same input');
    expect(decrypt(b)).toBe('same input');
  });

  it('rejects tampered ciphertext (GCM auth tag)', () => {
    const enc = encrypt('secret');
    const buf = Buffer.from(enc, 'base64');
    // Flip a bit in the ciphertext region (after IV + tag).
    if (buf.length > 28) {
      buf[28] = (buf[28] ?? 0) ^ 0x01;
    }
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('round-trips unicode', () => {
    const value = 'şifre—密码—🔐';
    const enc = encrypt(value);
    expect(decrypt(enc)).toBe(value);
  });

  it('handles empty strings', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });
});

describe('invite codes', () => {
  it('generates well-formed codes', () => {
    for (let i = 0; i < 25; i++) {
      const { code, codeHash } = generateInviteCode();
      expect(isWellFormedInviteCode(code)).toBe(true);
      expect(codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(codeHash).not.toContain(code);
    }
  });

  it('hashes are stable', () => {
    const code = 'TABS-ABCDE-23456';
    expect(hashInviteCode(code)).toBe(hashInviteCode(code.toLowerCase()));
  });

  it('rejects malformed codes', () => {
    expect(isWellFormedInviteCode('TABS-ABCDE-23456')).toBe(true);
    expect(isWellFormedInviteCode('tabs-abcde-23456')).toBe(true); // lowercased
    expect(isWellFormedInviteCode('TABS-ABCD-23456')).toBe(false); // wrong group size
    expect(isWellFormedInviteCode('TABS-ABCDE-234567')).toBe(false);
    expect(isWellFormedInviteCode('NOTTABS-ABCDE-23456')).toBe(false);
    expect(isWellFormedInviteCode('TABS-ABC01-23456')).toBe(false); // contains 0/1
    expect(isWellFormedInviteCode('')).toBe(false);
  });
});

describe('session tokens', () => {
  it('generates a 32-byte token and a 64-char hex hash', () => {
    const { token, tokenHash } = generateSessionToken();
    // 32 bytes base64url = 43 chars (no padding).
    expect(token.length).toBeGreaterThanOrEqual(42);
    expect(token.length).toBeLessThanOrEqual(44);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash is stable and does not reveal the token', () => {
    const { token, tokenHash } = generateSessionToken();
    expect(hashSessionToken(token)).toBe(tokenHash);
    expect(tokenHash).not.toContain(token);
  });

  it('two tokens collide only by chance', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe('sanitizeFilename', () => {
  it('strips path separators', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('system32');
    expect(sanitizeFilename('/etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('C:\\evil\\file.txt')).toBe('file.txt');
  });

  it('strips NUL bytes and control characters', () => {
    expect(sanitizeFilename('foo\u0000.txt')).toBe('foo.txt');
    expect(sanitizeFilename('foo\u0001\u0007.txt')).toBe('foo.txt');
    expect(sanitizeFilename('foo\u007f.txt')).toBe('foo.txt');
  });

  it('strips leading dots so dotfiles cannot be created', () => {
    expect(sanitizeFilename('.htaccess')).toBe('htaccess');
    expect(sanitizeFilename('...evil')).toBe('evil');
    expect(sanitizeFilename('..')).toBe('file');
  });

  it('preserves the extension', () => {
    expect(sanitizeFilename('image.png')).toBe('image.png');
    expect(sanitizeFilename('archive.tar.gz')).toBe('archive.tar.gz');
  });

  it('replaces unsafe characters with underscore', () => {
    expect(sanitizeFilename('weird;|`$()name.txt')).toBe('weird_______name.txt'.replace(/_{2,}/g, '_'));
    // Actually the collapse step gives a single underscore — check it.
    expect(sanitizeFilename('weird;|`$()name.txt')).toBe('weird_name.txt');
  });

  it('bounds the length while keeping the extension', () => {
    const long = 'a'.repeat(500) + '.txt';
    const out = sanitizeFilename(long);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith('.txt')).toBe(true);
  });

  it('falls back to "file" for empty / whitespace input', () => {
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('   ')).toBe('file');
    expect(sanitizeFilename('\u0000\u0000')).toBe('file');
  });

  it('keeps reasonable filenames untouched', () => {
    expect(sanitizeFilename('Meeting Notes 2025-11-15.md')).toBe('Meeting Notes 2025-11-15.md');
    expect(sanitizeFilename('photo_001.jpeg')).toBe('photo_001.jpeg');
  });
});

describe('resolveStoragePath', () => {
  it('rejects ownerId with traversal characters', () => {
    expect(() => resolveStoragePath('../evil', 'fid123', 'x.txt')).toThrow(/unsafe ownerId/);
    expect(() => resolveStoragePath('a/b', 'fid123', 'x.txt')).toThrow(/unsafe ownerId/);
  });

  it('rejects fileId with traversal characters', () => {
    expect(() => resolveStoragePath('user1', '../evil', 'x.txt')).toThrow(/unsafe fileId/);
    expect(() => resolveStoragePath('user1', 'a/b', 'x.txt')).toThrow(/unsafe fileId/);
  });

  it('sanitizes the storedName before joining', () => {
    const p = resolveStoragePath('user1', 'fid12345', '../../../etc/passwd');
    // The sanitized name is "passwd" → final path ends with the safe name.
    expect(p.endsWith('passwd')).toBe(true);
    expect(p).not.toContain('etc/passwd');
    expect(p).not.toContain('etc\\passwd');
  });
});
