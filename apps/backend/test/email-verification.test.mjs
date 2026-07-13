import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createEmailVerificationCode,
  emailVerificationExpiryState,
  emailVerificationQuotaExceeded,
  hashEmailVerificationCode,
  hashEmailVerificationRateKey,
  hashVerificationRequestIp,
  isEmailVerificationAtomicClaimCurrent,
  maskEmailAddress,
  normalizeEmailAddress,
  normalizeEmailVerificationCode,
  verifyEmailVerificationCode,
} from '../lib/email-verification.ts';

test('email normalization accepts deliverable-looking addresses and rejects malformed input', () => {
  assert.equal(normalizeEmailAddress(' Listener+sync@Example.COM '), 'listener+sync@example.com');
  assert.equal(normalizeEmailAddress('missing-domain@'), null);
  assert.equal(normalizeEmailAddress('missing-tld@example'), null);
  assert.equal(normalizeEmailAddress('double..dot@example.com'), null);
  assert.equal(normalizeEmailAddress('two@@example.com'), null);
});

test('verification codes are fixed-width and normalized for human entry', () => {
  assert.equal(createEmailVerificationCode(() => 0), '000000');
  assert.equal(createEmailVerificationCode(() => 999999), '999999');
  assert.equal(normalizeEmailVerificationCode('123-456'), '123456');
  assert.equal(normalizeEmailVerificationCode('12345'), null);
  assert.equal(normalizeEmailVerificationCode('12345x'), null);
});

test('verification codes use a registration-bound keyed hash', () => {
  const previousSecret = process.env.EMAIL_VERIFICATION_SECRET;
  process.env.EMAIL_VERIFICATION_SECRET = 'email-verification-test-secret';
  try {
    const digest = hashEmailVerificationCode('registration-one', '123456');
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.ok(!digest.includes('123456'));
    assert.equal(verifyEmailVerificationCode('registration-one', '123456', digest), true);
    assert.equal(verifyEmailVerificationCode('registration-two', '123456', digest), false);
    assert.equal(verifyEmailVerificationCode('registration-one', '654321', digest), false);
  } finally {
    if (previousSecret === undefined) delete process.env.EMAIL_VERIFICATION_SECRET;
    else process.env.EMAIL_VERIFICATION_SECRET = previousSecret;
  }
});

test('email masking keeps the delivery domain visible', () => {
  assert.equal(maskEmailAddress('listener@example.com'), 'li******@example.com');
  assert.equal(maskEmailAddress('a@example.com'), 'a**@example.com');
});

test('code expiry keeps a registration eligible for resend until its registration TTL', () => {
  const created = new Date('2026-07-13T00:00:00.000Z');
  const codeExpiry = new Date('2026-07-13T00:10:00.000Z');
  assert.equal(emailVerificationExpiryState(created, codeExpiry, new Date('2026-07-13T00:09:00.000Z')), 'active');
  assert.equal(emailVerificationExpiryState(created, codeExpiry, new Date('2026-07-13T00:11:00.000Z')), 'code_expired');
  assert.equal(emailVerificationExpiryState(created, codeExpiry, new Date('2026-07-14T00:00:01.000Z')), 'registration_expired');
});

test('atomic verification claims reject resend rotation, expiry, consumption, and exhausted attempts', () => {
  const now = new Date('2026-07-13T00:05:00.000Z');
  const expectedCodeHash = 'current-code-hash';
  const current = {
    codeHash: expectedCodeHash,
    consumedAt: null,
    attemptCount: 1,
    createdAt: new Date('2026-07-13T00:00:00.000Z'),
    expiresAt: new Date('2026-07-13T00:10:00.000Z'),
  };

  assert.equal(isEmailVerificationAtomicClaimCurrent(current, expectedCodeHash, now), true);
  assert.equal(isEmailVerificationAtomicClaimCurrent({ ...current, codeHash: 'resend-rotated-hash' }, expectedCodeHash, now), false);
  assert.equal(isEmailVerificationAtomicClaimCurrent({ ...current, consumedAt: now }, expectedCodeHash, now), false);
  assert.equal(isEmailVerificationAtomicClaimCurrent({ ...current, expiresAt: now }, expectedCodeHash, now), false);
  assert.equal(isEmailVerificationAtomicClaimCurrent({ ...current, attemptCount: 5 }, expectedCodeHash, now), true);
  assert.equal(isEmailVerificationAtomicClaimCurrent({ ...current, attemptCount: 0 }, expectedCodeHash, now), false);
  assert.equal(isEmailVerificationAtomicClaimCurrent({ ...current, attemptCount: 6 }, expectedCodeHash, now), false);
});

test('global verification quota includes signup and resend reservations', () => {
  assert.equal(emailVerificationQuotaExceeded(3, 10), false);
  assert.equal(emailVerificationQuotaExceeded(4, 1), true);
  assert.equal(emailVerificationQuotaExceeded(1, 11), true);
});

test('rate limit keys are opaque and prefer Vercel trusted forwarding', () => {
  const previousSecret = process.env.EMAIL_VERIFICATION_SECRET;
  process.env.EMAIL_VERIFICATION_SECRET = 'email-verification-test-secret';
  try {
    assert.match(hashEmailVerificationRateKey('email', 'Listener@Example.com'), /^[a-f0-9]{64}$/);
    const trusted = hashVerificationRequestIp(new Request('https://spice.test', {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.5',
        'x-forwarded-for': '198.51.100.10',
      },
    }));
    const expected = hashVerificationRequestIp(new Request('https://spice.test', {
      headers: { 'x-vercel-forwarded-for': '203.0.113.5' },
    }));
    assert.equal(trusted, expected);
  } finally {
    if (previousSecret === undefined) delete process.env.EMAIL_VERIFICATION_SECRET;
    else process.env.EMAIL_VERIFICATION_SECRET = previousSecret;
  }
});

test('email verification migration grandfathers existing users without storing plaintext codes', async () => {
  const sql = await readFile(new URL('../db/migrations/0010_email_verification.sql', import.meta.url), 'utf8');
  assert.match(sql, /UPDATE "users" SET "email_verified_at" = now\(\)/);
  assert.match(sql, /"code_hash" text NOT NULL/);
  assert.doesNotMatch(sql, /"code" text NOT NULL/);
});
