import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/cors';
import { db } from '@/db';
import { users, listenTogetherSessions, profiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  isListenTogetherSessionActive,
  normalizeListenTogetherHostState,
  parseListenTogetherQueueState,
  parseListenTogetherTrack,
  projectListenTogetherProgressMs,
  serializeListenTogetherQueueState,
} from '@/app/listen-together-core';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

// Host updates session playback state
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
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) {
      return jsonResponse({ error: 'invalid_request', message: 'Session ID is required.' }, { status: 400 });
    }
    const hostState = normalizeListenTogetherHostState(body);
    const updatedAt = new Date();

    // Atomically verify host ownership and update without fetching the session row.
    const updatedSessions = await db.update(listenTogetherSessions)
      .set({
        currentTrackJson: hostState.currentTrack ? JSON.stringify(hostState.currentTrack) : null,
        queueJson: serializeListenTogetherQueueState(hostState),
        queueIndex: hostState.queueIndex,
        isPlaying: hostState.isPlaying,
        progressMs: hostState.progressMs,
        durationMs: hostState.durationMs,
        updatedAt,
      })
      .where(and(
        eq(listenTogetherSessions.id, sessionId),
        eq(listenTogetherSessions.hostUserId, session.userId)
      ))
      .returning({ id: listenTogetherSessions.id });

    if (updatedSessions.length === 0) {
      return jsonResponse({ error: 'unauthorized_session', message: 'You are not the host of this session.' }, { status: 403 });
    }

    return jsonResponse({ success: true, updatedAt: updatedAt.toISOString() });
  } catch (error) {
    return jsonResponse({ error: 'sync_failed', message: error instanceof Error ? error.message : 'Failed to update sync state.' }, { status: 500 });
  }
}

// Listener fetches session playback state
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return jsonResponse({ error: 'missing_session_id', message: 'Session ID is required.' }, { status: 400 });
    }

    const session = await db
      .select({
        sessionId: listenTogetherSessions.id,
        currentTrackJson: listenTogetherSessions.currentTrackJson,
        queueJson: listenTogetherSessions.queueJson,
        queueIndex: listenTogetherSessions.queueIndex,
        isPlaying: listenTogetherSessions.isPlaying,
        progressMs: listenTogetherSessions.progressMs,
        durationMs: listenTogetherSessions.durationMs,
        updatedAt: listenTogetherSessions.updatedAt,
        hostUserId: users.id,
        hostUserUsername: users.username,
        hostProfileUsername: profiles.username,
        hostDisplayName: profiles.displayName,
      })
      .from(listenTogetherSessions)
      .innerJoin(users, eq(listenTogetherSessions.hostUserId, users.id))
      .leftJoin(
        profiles,
        and(
          eq(profiles.userId, users.id),
          eq(profiles.id, listenTogetherSessions.hostProfileId)
        )
      )
      .where(eq(listenTogetherSessions.id, sessionId))
      .then(rows => rows[0]);

    if (!session) {
      return jsonResponse({ error: 'session_not_found', message: 'Session not found.' }, { status: 404 });
    }

    const serverTime = new Date();
    const isActive = isListenTogetherSessionActive(session.updatedAt, serverTime);
    const currentTrack = parseListenTogetherTrack(session.currentTrackJson);
    const queueState = parseListenTogetherQueueState(session.queueJson);
    const targetProgressMs = projectListenTogetherProgressMs({
      progressMs: session.progressMs,
      durationMs: session.durationMs,
      isPlaying: Boolean(session.isPlaying && currentTrack),
      updatedAt: session.updatedAt,
      now: serverTime,
    });

    return jsonResponse({
      isActive,
      sessionId: session.sessionId,
      hostName: session.hostDisplayName || session.hostProfileUsername || session.hostUserUsername || 'Host',
      isPlaying: Boolean(session.isPlaying && currentTrack),
      progressMs: session.progressMs,
      targetProgressMs,
      durationMs: session.durationMs,
      currentTrack,
      queue: queueState.queue,
      queueIndex: session.queueIndex,
      shuffleEnabled: queueState.shuffleEnabled,
      repeatMode: queueState.repeatMode,
      updatedAt: session.updatedAt,
      serverTime: serverTime.toISOString(),
    });
  } catch (error) {
    return jsonResponse({ error: 'sync_fetch_failed', message: error instanceof Error ? error.message : 'Failed to fetch sync state.' }, { status: 500 });
  }
}
