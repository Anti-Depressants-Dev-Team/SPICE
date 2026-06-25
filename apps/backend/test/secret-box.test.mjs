import test from 'node:test';
import assert from 'node:assert';
import { encryptSecret, decryptSecret } from '../lib/secret-box.ts';

test('secret-box uses JWT_SECRET or PROFILE_CONNECTION_SECRET', () => {
  process.env.JWT_SECRET = 'test_jwt_secret';
  const encrypted = encryptSecret('my_secret_data');
  const decrypted = decryptSecret(encrypted);
  assert.strictEqual(decrypted, 'my_secret_data');

  delete process.env.JWT_SECRET;
  process.env.PROFILE_CONNECTION_SECRET = 'test_profile_secret';
  const encrypted2 = encryptSecret('another_secret');
  const decrypted2 = decryptSecret(encrypted2);
  assert.strictEqual(decrypted2, 'another_secret');

  delete process.env.PROFILE_CONNECTION_SECRET;
});

test('secret-box throws error when no secret is configured', () => {
  delete process.env.JWT_SECRET;
  delete process.env.PROFILE_CONNECTION_SECRET;
  assert.throws(() => encryptSecret('data'), /Missing encryption key/);
  assert.throws(() => decryptSecret('v1:iv:tag:data'), /Missing encryption key/);
});
