import assert from 'node:assert/strict';
import test from 'node:test';

import { enableDatabaseIntegrationTests } from './database-test-helper.mjs';

const hasTestDb = enableDatabaseIntegrationTests();

test('durable rate reservations atomically expose the first over-limit attempt', { skip: !hasTestDb }, async () => {
  const { db } = await import('../db/index.ts');
  const { emailVerificationRateLimits } = await import('../db/schema.ts');
  const { and, eq } = await import('drizzle-orm');
  const { reserveDurableRateLimits } = await import('../lib/durable-rate-limit.ts');

  const scope = `test_rate_${Date.now()}`;
  const keyHash = `key-${Math.random().toString(16).slice(2)}`;
  const now = new Date('2026-07-13T12:07:30.000Z');
  try {
    const results = await Promise.all(Array.from({ length: 21 }, () => reserveDurableRateLimits({
      now,
      windowMs: 15 * 60 * 1000,
      reservations: [{ scope, keyHash, limit: 20 }],
    })));
    const counts = results.map((result) => result.attempts[scope]).sort((a, b) => a - b);
    assert.deepEqual(counts, Array.from({ length: 21 }, (_, index) => index + 1));
    assert.equal(results.filter((result) => result.limited).length, 1);
  } finally {
    await db.delete(emailVerificationRateLimits).where(and(
      eq(emailVerificationRateLimits.scope, scope),
      eq(emailVerificationRateLimits.keyHash, keyHash),
    ));
  }
});
