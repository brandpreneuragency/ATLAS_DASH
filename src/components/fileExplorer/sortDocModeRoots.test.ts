import { describe, expect, it } from 'vitest';
import { sortDocModeRoots } from './sortDocModeRoots';
import type { FsRoot } from '../../services/tabsApi';

function root(id: string, label = id): FsRoot {
  return { id, label, path: `/x/${id}` };
}

describe('sortDocModeRoots', () => {
  it('places memories immediately after atlas', () => {
    const input = [root('home', 'VPS Home'), root('memories', 'Hermes Memories'), root('atlas', 'ATLAS')];
    expect(sortDocModeRoots(input).map((r) => r.id)).toEqual(['atlas', 'memories', 'home']);
  });

  it('keeps relative order of unpinned roots', () => {
    const input = [root('zeta'), root('home'), root('atlas'), root('memories'), root('alpha')];
    expect(sortDocModeRoots(input).map((r) => r.id)).toEqual([
      'atlas',
      'memories',
      'zeta',
      'home',
      'alpha',
    ]);
  });

  it('still pins memories when atlas is absent', () => {
    const input = [root('home'), root('memories')];
    expect(sortDocModeRoots(input).map((r) => r.id)).toEqual(['memories', 'home']);
  });

  it('preserves server labels', () => {
    const input = [root('memories', 'Hermes Memories'), root('atlas', 'ATLAS')];
    const sorted = sortDocModeRoots(input);
    expect(sorted.find((r) => r.id === 'memories')?.label).toBe('Hermes Memories');
  });
});
