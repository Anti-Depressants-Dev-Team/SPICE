import { lt, sql } from 'drizzle-orm';

import { db } from '@/db';
import { emailVerificationRateLimits } from '@/db/schema';
import { fixedRateLimitWindow, rateLimitExceeded } from '@/lib/rate-limit-policy';

export interface DurableRateLimitReservation {
  scope: string;
  keyHash: string;
  limit: number;
}

export interface DurableRateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
  attempts: Record<string, number>;
}

export async function reserveDurableRateLimits(input: {
  reservations: DurableRateLimitReservation[];
  windowMs: number;
  now?: Date;
}): Promise<DurableRateLimitResult> {
  const now = input.now ?? new Date();
  const { windowStart, retryAfterSeconds } = fixedRateLimitWindow(now, input.windowMs);
  const cleanupCutoff = new Date(windowStart.getTime() - 24 * 60 * 60 * 1000);
  await db.delete(emailVerificationRateLimits)
    .where(lt(emailVerificationRateLimits.windowStart, cleanupCutoff));

  const attemptEntries = await Promise.all(input.reservations.map(async (reservation) => {
    const [saved] = await db.insert(emailVerificationRateLimits)
      .values({
        scope: reservation.scope,
        keyHash: reservation.keyHash,
        windowStart,
        attemptCount: 1,
        lastAttemptAt: now,
      })
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
    return [reservation.scope, Number(saved?.attemptCount ?? Number.POSITIVE_INFINITY)] as const;
  }));

  const attempts = Object.fromEntries(attemptEntries);
  const limited = input.reservations.some((reservation) =>
    rateLimitExceeded(attempts[reservation.scope] ?? Number.POSITIVE_INFINITY, reservation.limit));
  return { limited, retryAfterSeconds, attempts };
}
