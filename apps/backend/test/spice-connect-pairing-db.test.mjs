import assert from 'node:assert/strict';
import test from 'node:test';

import { enableDatabaseIntegrationTests } from './database-test-helper.mjs';

const hasTestDb = enableDatabaseIntegrationTests();

test('Spice Connect pairing atomically blocks replay and honors revocation', { skip: !hasTestDb }, async () => {
  const { db } = await import('../db/index.ts');
  const {
    remoteDeviceAuthorizations,
    remotePairingCodes,
    users,
  } = await import('../db/schema.ts');
  const { and, eq, gt, isNull } = await import('drizzle-orm');

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [user] = await db.insert(users).values({
    email: `pairing-${suffix}@example.com`,
  }).returning();

  try {
    const now = new Date();
    const codeHash = `pair-code-${suffix}`;
    await db.insert(remotePairingCodes).values({
      userId: user.id,
      issuerDeviceId: 'issuer-device',
      codeHash,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    const consume = () => db
      .update(remotePairingCodes)
      .set({ consumedAt: now, consumedByDeviceId: 'phone-device' })
      .where(and(
        eq(remotePairingCodes.codeHash, codeHash),
        isNull(remotePairingCodes.consumedAt),
        isNull(remotePairingCodes.revokedAt),
        gt(remotePairingCodes.expiresAt, now),
      ))
      .returning({ id: remotePairingCodes.id });

    assert.equal((await consume()).length, 1);
    assert.equal((await consume()).length, 0);

    const [authorization] = await db.insert(remoteDeviceAuthorizations).values({
      userId: user.id,
      issuerDeviceId: 'issuer-device',
      deviceId: 'phone-device',
      tokenHash: `pair-token-${suffix}`,
      expiresAt: new Date(now.getTime() + 60_000),
    }).returning();

    await db
      .update(remoteDeviceAuthorizations)
      .set({ revokedAt: now })
      .where(eq(remoteDeviceAuthorizations.id, authorization.id));

    const active = await db.query.remoteDeviceAuthorizations.findFirst({
      where: and(
        eq(remoteDeviceAuthorizations.id, authorization.id),
        isNull(remoteDeviceAuthorizations.revokedAt),
        gt(remoteDeviceAuthorizations.expiresAt, now),
      ),
    });
    assert.equal(active, undefined);
  } finally {
    await db.delete(users).where(eq(users.id, user.id));
  }
});
