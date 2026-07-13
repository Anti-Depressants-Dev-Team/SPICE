import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fixedRateLimitWindow,
  hashRateLimitRequestIp,
  hashScopedRateLimitKey,
  normalizeRateLimitValue,
  rateLimitExceeded,
} from '../lib/rate-limit-policy.ts';

test('scoped rate-limit keys are opaque and isolated by purpose', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'rate-limit-test-secret';
  try {
    const account = hashScopedRateLimitKey('auth_signin_account', ' Listener@Example.com ');
    const pairing = hashScopedRateLimitKey('remote_pair_claim_code', ' Listener@Example.com ');
    assert.match(account, /^[a-f0-9]{64}$/);
    assert.ok(!account.includes('listener'));
    assert.notEqual(account, pairing);
    assert.equal(account, hashScopedRateLimitKey('auth_signin_account', 'listener@example.com'));
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('IP rate keys prefer the trusted Vercel forwarding header', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'rate-limit-test-secret';
  try {
    const request = new Request('https://spice.test', {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.5',
        'x-forwarded-for': '198.51.100.9',
      },
    });
    const expected = hashRateLimitRequestIp(new Request('https://spice.test', {
      headers: { 'x-vercel-forwarded-for': '203.0.113.5' },
    }), 'auth_signin_ip');
    assert.equal(hashRateLimitRequestIp(request, 'auth_signin_ip'), expected);
    assert.notEqual(
      hashRateLimitRequestIp(request, 'auth_signin_ip'),
      hashRateLimitRequestIp(request, 'remote_pair_claim_ip'),
    );
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('fixed windows expose a bounded Retry-After and post-increment limits', () => {
  const now = new Date('2026-07-13T12:07:30.000Z');
  const window = fixedRateLimitWindow(now, 15 * 60 * 1000);
  assert.equal(window.windowStart.toISOString(), '2026-07-13T12:00:00.000Z');
  assert.equal(window.retryAfterSeconds, 450);
  assert.equal(rateLimitExceeded(20, 20), false);
  assert.equal(rateLimitExceeded(21, 20), true);
  assert.equal(normalizeRateLimitValue('  ABCD-2345  ', 32), 'abcd-2345');
});
