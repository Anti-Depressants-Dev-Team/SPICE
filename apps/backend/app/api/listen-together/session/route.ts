import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/cors';
import { db } from '@/db';
import { listenTogetherSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isListenTogetherSessionActive } from '@/app/listen-together-core';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
    }

    const session = await verifySession(auth.substring(7));
    if (!process.env.DATABASE_URL) {
      return jsonResponse({ error: 'database_not_configured', message: 'DATABASE_URL is not configured.' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : 'default';

    const [hostSession] = await db.insert(listenTogetherSessions).values({
        hostUserId: session.userId,
        hostProfileId: profileId,
      })
      .onConflictDoUpdate({
        target: listenTogetherSessions.hostUserId,
        set: { hostProfileId: profileId, updatedAt: new Date() },
      })
      .returning();

    return jsonResponse({ success: true, session: hostSession });
  } catch (error) {
    return jsonResponse({ error: 'session_creation_failed', message: error instanceof Error ? error.message : 'Failed to create session.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (!process.env.DATABASE_URL) {
      return jsonResponse({ error: 'database_not_configured', message: 'DATABASE_URL is not configured.' }, { status: 500 });
    }

    let hostUserId: string | null = null;
    if (!sessionId) {
      const auth = request.headers.get('Authorization');
      if (!auth?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
      }
      hostUserId = (await verifySession(auth.substring(7))).userId;
    }

    const hostedSession = await db.query.listenTogetherSessions.findFirst({
      where: sessionId
        ? eq(listenTogetherSessions.id, sessionId)
        : eq(listenTogetherSessions.hostUserId, hostUserId!),
    });

    if (!hostedSession) {
      return jsonResponse({ error: 'session_not_found', message: 'Session not found.' }, { status: 404 });
    }

    return jsonResponse({
      session: hostedSession,
      isActive: isListenTogetherSessionActive(hostedSession.updatedAt),
    });
  } catch (error) {
    return jsonResponse({ error: 'fetch_session_failed', message: error instanceof Error ? error.message : 'Failed to fetch session.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
    }

    const session = await verifySession(auth.substring(7));
    if (!process.env.DATABASE_URL) {
      return jsonResponse({ error: 'database_not_configured', message: 'DATABASE_URL is not configured.' }, { status: 500 });
    }

    await db.delete(listenTogetherSessions)
      .where(eq(listenTogetherSessions.hostUserId, session.userId));

    return jsonResponse({ success: true, message: 'Session ended.' });
  } catch (error) {
    return jsonResponse({ error: 'end_session_failed', message: error instanceof Error ? error.message : 'Failed to end session.' }, { status: 500 });
  }
}
