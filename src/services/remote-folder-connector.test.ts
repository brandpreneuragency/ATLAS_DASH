// src/services/remote-folder-connector.test.ts
import { describe, expect, it } from 'vitest';
import { joinRemotePath, splitRemotePath } from './remote-folder-connector';

describe('remote path codec', () => {
  it('splits root:rel', () => {
    expect(splitRemotePath('atlas:notes/today.md')).toEqual({ root: 'atlas', rel: 'notes/today.md' });
  });
  it('handles root-only paths', () => {
    expect(splitRemotePath('atlas:')).toEqual({ root: 'atlas', rel: '' });
  });
  it('joins back', () => {
    expect(joinRemotePath('atlas', 'notes/today.md')).toBe('atlas:notes/today.md');
  });
  it('throws on paths without a root prefix', () => {
    expect(() => splitRemotePath('/etc/passwd')).toThrow();
  });
});
