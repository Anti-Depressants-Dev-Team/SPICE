import type { NextRequest } from 'next/server';

import { verifySession } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/cors';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
    }

    const session = await verifySession(auth.substring(7));
    if (!process.env.DATABASE_URL) {
      return jsonResponse(
        { error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' },
        { status: 500 },
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    return jsonResponse({ username: user?.username || null });
  } catch (error) {
    return jsonResponse(
      {
        error: 'username_get_failed',
        message: error instanceof Error ? error.message : 'Failed to get username.',
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
    }

    const session = await verifySession(auth.substring(7));
    if (!process.env.DATABASE_URL) {
      return jsonResponse(
        { error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username.trim() : '';

    if (!usernamePattern.test(username)) {
      return jsonResponse(
        {
          error: 'invalid_username',
          message: 'Username must be 3–20 characters, letters, numbers, and underscores only.',
        },
        { status: 400 },
      );
    }

    const cleanUsername = username.trim().toLowerCase();

    const existing = await db.query.users.findFirst({
      where: eq(users.username, cleanUsername),
    });

    if (existing && existing.id !== session.userId) {
      return jsonResponse(
        { error: 'username_taken', message: 'This username is already taken.' },
        { status: 409 }
      );
    }

    await db.update(users).set({ username: cleanUsername }).where(eq(users.id, session.userId));

    return jsonResponse({ success: true, username: cleanUsername });
  } catch (error) {
    return jsonResponse(
      {
        error: 'username_update_failed',
        message: error instanceof Error ? error.message : 'Failed to update username.',
      },
      { status: 500 },
    );
  }
}
