import { db } from '@/db';
import { accountSubscriptions, users } from '@/db/schema';
import { serializeAccount, isAdminAccount, type AccountSnapshot } from '@/lib/account';
import type { SpiceSession } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export class AccountAuthorizationError extends Error {
  constructor(
    public readonly code: 'account_not_found' | 'admin_required',
    message: string,
  ) {
    super(message);
    this.name = 'AccountAuthorizationError';
  }
}

export async function getAccountSnapshotForSession(session: Pick<SpiceSession, 'userId'>): Promise<AccountSnapshot | null> {
  return getAccountSnapshotForUserId(session.userId);
}

export async function getAccountSnapshotForUserId(userId: string): Promise<AccountSnapshot | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return null;
  }

  const subscription = await db.query.accountSubscriptions.findFirst({
    where: eq(accountSubscriptions.userId, userId),
  });

  return serializeAccount(user, subscription);
}

export async function requireAdminAccount(session: Pick<SpiceSession, 'userId'>): Promise<AccountSnapshot> {
  const account = await getAccountSnapshotForSession(session);

  if (!account) {
    throw new AccountAuthorizationError('account_not_found', 'The authenticated account no longer exists.');
  }

  if (!isAdminAccount(account)) {
    throw new AccountAuthorizationError('admin_required', 'This endpoint requires an admin account.');
  }

  return account;
}
