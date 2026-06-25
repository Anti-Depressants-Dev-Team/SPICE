import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword, verifyPassword } from '../lib/hash.ts';

test('hashPassword creates a properly formatted hash string', () => {
  const result = hashPassword('my-secret-password');

  // It should contain exactly one colon
  const parts = result.split(':');
  assert.equal(parts.length, 2);

  // Both salt and hash should be non-empty hex strings
  const [salt, hash] = parts;
  assert.ok(salt.length > 0);
  assert.ok(hash.length > 0);
  assert.match(salt, /^[0-9a-f]+$/i);
  assert.match(hash, /^[0-9a-f]+$/i);
});

test('hashPassword produces different results for the same password', () => {
  const password = 'same-password';
  const result1 = hashPassword(password);
  const result2 = hashPassword(password);

  assert.notEqual(result1, result2);
});

test('verifyPassword correctly validates a valid password', () => {
  const password = 'correct-horse-battery-staple';
  const storedHash = hashPassword(password);

  assert.equal(verifyPassword(password, storedHash), true);
});

test('verifyPassword rejects an invalid password', () => {
  const password = 'correct-horse-battery-staple';
  const storedHash = hashPassword(password);

  assert.equal(verifyPassword('wrong-password', storedHash), false);
});

test('verifyPassword rejects incorrectly formatted hashes', () => {
  const password = 'my-password';

  // Missing colon
  assert.equal(verifyPassword(password, 'invalidhashstring'), false);

  // Empty salt
  assert.equal(verifyPassword(password, ':hashpart'), false);

  // Empty hash
  assert.equal(verifyPassword(password, 'saltpart:'), false);

  // Too many colons
  assert.equal(verifyPassword(password, 'salt:hash:extra'), false);
});
