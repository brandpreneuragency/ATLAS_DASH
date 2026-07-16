// server/lib/paths.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSafe, isSensitive } from './paths.mjs';

const roots = [
  { id: 'home', label: 'VPS Home', path: '/home/admin' },
  { id: 'memories', label: 'Hermes Memories', path: '/home/admin/.hermes/memories' },
];

test('resolves a normal relative path inside the root', () => {
  assert.equal(resolveSafe(roots[0], 'atlas/notes.md'), '/home/admin/atlas/notes.md');
});

test('rejects .. escape', () => {
  assert.equal(resolveSafe(roots[0], '../etc/passwd'), null);
  assert.equal(resolveSafe(roots[0], 'a/../../etc/passwd'), null);
});

test('rejects absolute path input', () => {
  assert.equal(resolveSafe(roots[0], '/etc/passwd'), null);
});

test('empty path resolves to the root itself', () => {
  assert.equal(resolveSafe(roots[0], ''), '/home/admin');
});

test('.env files are sensitive under any root', () => {
  assert.equal(isSensitive('/home/admin/project/.env', roots[0], roots), true);
  assert.equal(isSensitive('/home/admin/project/.env.local', roots[0], roots), true);
});

test('.hermes is sensitive via the home root', () => {
  assert.equal(isSensitive('/home/admin/.hermes/config.yaml', roots[0], roots), true);
});

test('.hermes/memories is NOT sensitive via the memories root', () => {
  assert.equal(isSensitive('/home/admin/.hermes/memories/notes.md', roots[1], roots), false);
});

test('regular files are not sensitive', () => {
  assert.equal(isSensitive('/home/admin/atlas/notes.md', roots[0], roots), false);
});
