import test from 'node:test';
import assert from 'node:assert';
import { buildSignedStreamUrl } from '../lib/stream-signing.ts';

test('STREAM_HMAC_SECRET required in production', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSpice = process.env.SPICE_STREAM_HMAC_SECRET;
  const originalStream = process.env.STREAM_HMAC_SECRET;
  const originalAuth = process.env.AUTH_SECRET;
  const originalNext = process.env.NEXTAUTH_SECRET;

  process.env.NODE_ENV = 'production';
  delete process.env.SPICE_STREAM_HMAC_SECRET;
  delete process.env.STREAM_HMAC_SECRET;
  delete process.env.AUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;

  try {
    buildSignedStreamUrl('https://example.com', { id: 'test', itag: 1, expiresAt: 0, upstreamUrl: 'test' });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.match(err.message, /STREAM_HMAC_SECRET is required in production/);
  }

  process.env.NODE_ENV = originalEnv;
  if (originalSpice !== undefined) process.env.SPICE_STREAM_HMAC_SECRET = originalSpice;
  if (originalStream !== undefined) process.env.STREAM_HMAC_SECRET = originalStream;
  if (originalAuth !== undefined) process.env.AUTH_SECRET = originalAuth;
  if (originalNext !== undefined) process.env.NEXTAUTH_SECRET = originalNext;
});
