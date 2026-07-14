import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createPairingCode,
  createRemoteDeviceToken,
  formatPairingCode,
  hashPairingCode,
  hashRemoteDeviceToken,
  isPairingCodeClaimable,
  isRemoteDeviceAuthorizationActive,
  isSpiceConnectAccountRoleActive,
  isRemoteDeviceToken,
  normalizePairingCode,
  normalizePairingDeviceInput,
  resolveRemoteAuthorizationRevoke,
  SPICE_CONNECT_DEVICE_TOKEN_PREFIX,
} from '../lib/spice-connect-pairing.ts';

test('Spice Connect rejects banned account roles at live authorization boundaries', () => {
  assert.equal(isSpiceConnectAccountRoleActive('user'), true);
  assert.equal(isSpiceConnectAccountRoleActive('admin'), true);
  assert.equal(isSpiceConnectAccountRoleActive('banned'), false);
});

test('pairing codes use an unambiguous normalized format', () => {
  assert.equal(normalizePairingCode('abcd-2345'), 'ABCD2345');
  assert.equal(normalizePairingCode('abcd2345'), 'ABCD2345');
  assert.equal(normalizePairingCode(' ABCD 2345 '), 'ABCD2345');
  assert.equal(normalizePairingCode('ABCD–2345'), 'ABCD2345');
  assert.equal(normalizePairingCode('ＡＢＣＤ－２３４５'), 'ABCD2345');
  assert.equal(formatPairingCode('abcd2345'), 'ABCD-2345');
  assert.equal(normalizePairingCode('ABCI2345'), null);
  assert.equal(normalizePairingCode('short'), null);
});

test('pairing code generation is bounded and display friendly', () => {
  const generated = createPairingCode((size) => Buffer.alloc(size, 0));
  assert.equal(generated.normalized, '22222222');
  assert.equal(generated.display, '2222-2222');
  assert.equal(normalizePairingCode(generated.display), generated.normalized);
});

test('pairing codes are keyed hashes rather than plaintext-at-rest values', () => {
  const previousSecret = process.env.SPICE_PAIRING_SECRET;
  process.env.SPICE_PAIRING_SECRET = 'test-pairing-pepper';
  try {
    const digest = hashPairingCode('ABCD-2345');
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.ok(!digest.includes('ABCD2345'));
    assert.equal(digest, hashPairingCode('abcd 2345'));
  } finally {
    if (previousSecret === undefined) delete process.env.SPICE_PAIRING_SECRET;
    else process.env.SPICE_PAIRING_SECRET = previousSecret;
  }
});

test('paired device credentials are opaque, scoped tokens with stable hashes', () => {
  const token = createRemoteDeviceToken((size) => Buffer.alloc(size, 7));
  assert.ok(token.startsWith(SPICE_CONNECT_DEVICE_TOKEN_PREFIX));
  assert.equal(isRemoteDeviceToken(token), true);
  assert.equal(isRemoteDeviceToken('ordinary-account-token'), false);
  assert.match(hashRemoteDeviceToken(token), /^[a-f0-9]{64}$/);
  assert.equal(hashRemoteDeviceToken(token), hashRemoteDeviceToken(token));
  assert.ok(!hashRemoteDeviceToken(token).includes(token));
});

test('pairing device input trims and bounds untrusted labels', () => {
  const normalized = normalizePairingDeviceInput({
    deviceId: `  phone-${'x'.repeat(200)}  `,
    displayName: `  Living room ${'y'.repeat(100)}  `,
  });
  assert.ok(normalized);
  assert.equal(normalized.deviceId.length, 120);
  assert.equal(normalized.displayName.length, 80);
  assert.equal(normalizePairingDeviceInput({ displayName: 'Missing id' }), null);
});

test('consumed, revoked, and expired pairing codes cannot be replayed', () => {
  const now = new Date('2026-07-13T12:00:00.000Z');
  const future = new Date(now.getTime() + 60_000);
  const past = new Date(now.getTime() - 1);

  assert.equal(isPairingCodeClaimable({ expiresAt: future }, now), true);
  assert.equal(isPairingCodeClaimable({ expiresAt: future, consumedAt: now }, now), false);
  assert.equal(isPairingCodeClaimable({ expiresAt: future, revokedAt: now }, now), false);
  assert.equal(isPairingCodeClaimable({ expiresAt: past }, now), false);
});

test('revoked and expired remote authorizations are inactive', () => {
  const now = new Date('2026-07-13T12:00:00.000Z');
  const future = new Date(now.getTime() + 60_000);
  const past = new Date(now.getTime() - 1);

  assert.equal(isRemoteDeviceAuthorizationActive({ expiresAt: future }, now), true);
  assert.equal(isRemoteDeviceAuthorizationActive({ expiresAt: past }, now), false);
  assert.equal(isRemoteDeviceAuthorizationActive({ expiresAt: future, revokedAt: now }, now), false);
});

test('idempotent revoke retries an authorization that became active during fallback', async () => {
  const revokedAt = new Date('2026-07-14T12:00:00.000Z');
  let revokeAttempts = 0;
  const retried = await resolveRemoteAuthorizationRevoke({
    tryRevoke: async () => {
      revokeAttempts += 1;
      return revokeAttempts === 2 ? { id: 'authorization', revokedAt } : null;
    },
    loadAuthorization: async () => ({ id: 'authorization', revokedAt: null }),
  });
  assert.equal(revokeAttempts, 2);
  assert.deepEqual(retried, {
    status: 'revoked',
    authorization: { id: 'authorization', revokedAt },
    alreadyRevoked: false,
  });

  const alreadyRevoked = await resolveRemoteAuthorizationRevoke({
    tryRevoke: async () => null,
    loadAuthorization: async () => ({ id: 'authorization', revokedAt }),
  });
  assert.equal(alreadyRevoked.status, 'revoked');
  assert.equal(alreadyRevoked.alreadyRevoked, true);

  const conflict = await resolveRemoteAuthorizationRevoke({
    tryRevoke: async () => null,
    loadAuthorization: async () => ({ id: 'authorization', revokedAt: null }),
    maxAttempts: 2,
  });
  assert.deepEqual(conflict, { status: 'conflict' });
});

test('pairing migration stores only code and credential hashes', async () => {
  const sql = await readFile(
    new URL('../db/migrations/0009_spice_connect_pairing.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /"code_hash" text NOT NULL/);
  assert.match(sql, /"token_hash" text NOT NULL/);
  assert.doesNotMatch(sql, /"code" text/i);
  assert.doesNotMatch(sql, /"access_token" text/i);
});
