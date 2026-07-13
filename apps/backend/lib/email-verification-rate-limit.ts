import { lt, sql } from 'drizzle-orm';

import { db } from '@/db';
import { emailVerificationRateLimits } from '@/db/schema';
import { hashEmailVerificationRateKey } from '@/lib/email-verification';

const HOUR_MS = 60 * 60 * 1000;

export async function reserveEmailVerificationQuota(input: {
  email: string;
  requestIpHash: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const windowStart = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  const cleanupCutoff = new Date(windowStart.getTime() - 24 * HOUR_MS);
  await db.delete(emailVerificationRateLimits)
    .where(lt(emailVerificationRateLimits.windowStart, cleanupCutoff));

  const reserve = async (scope: 'email' | 'ip', keyHash: string) => {
    const [reservation] = await db.insert(emailVerificationRateLimits)
      .values({ scope, keyHash, windowStart, attemptCount: 1, lastAttemptAt: now })
      .onConflictDoUpdate({
        target: [
          emailVerificationRateLimits.scope,
          emailVerificationRateLimits.keyHash,
          emailVerificationRateLimits.windowStart,
        ],
        set: {
          attemptCount: sql`${emailVerificationRateLimits.attemptCount} + 1`,
          lastAttemptAt: now,
        },
      })
      .returning({ attemptCount: emailVerificationRateLimits.attemptCount });
    return Number(reservation?.attemptCount ?? Number.POSITIVE_INFINITY);
  };

  const [emailAttempts, ipAttempts] = await Promise.all([
    reserve('email', hashEmailVerificationRateKey('email', input.email)),
    reserve('ip', input.requestIpHash),
  ]);
  return { emailAttempts, ipAttempts };
}
