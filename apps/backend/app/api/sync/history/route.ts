import { jsonResponse, optionsResponse } from '@/lib/cors';
import { verifySession } from '@/lib/auth';
import { db } from '@/db';
import { history } from '@/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { trackSnapshotColumns, trackSnapshotFromRow } from '@/lib/track-snapshot';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

type NormalizedHistoryItem = {
  sourceId: string;
  trackId: string;
  title: string;
  artistsJson: string;
  artworkUrl: string | null;
  durationMs: number | null;
};

type StoredHistoryItem = NormalizedHistoryItem & {
  id: string;
  playedAt: Date;
};

function historySnapshotMatches(existing: NormalizedHistoryItem, incoming: NormalizedHistoryItem) {
  return existing.sourceId === incoming.sourceId
    && existing.trackId === incoming.trackId
    && existing.title === incoming.title
    && existing.artistsJson === incoming.artistsJson
    && existing.artworkUrl === incoming.artworkUrl
    && existing.durationMs === incoming.durationMs;
}

export function historySnapshotsMatch(
  existing: NormalizedHistoryItem[],
  incoming: NormalizedHistoryItem[],
) {
  return existing.length === incoming.length
    && existing.every((row, index) => historySnapshotMatches(row, incoming[index]));
}

export function planHistorySnapshotChanges(
  existing: StoredHistoryItem[],
  incoming: NormalizedHistoryItem[],
) {
  if (existing.length > 50) {
    return { kind: 'replace' as const, insert: incoming, removeIds: existing.map((row) => row.id) };
  }
  if (historySnapshotsMatch(existing, incoming)) {
    return { kind: 'unchanged' as const, insert: [], removeIds: [] };
  }

  const incomingMatchesExistingPrefix = incoming.every((row, index) => (
    index < existing.length && historySnapshotMatches(existing[index], row)
  ));
  if (incomingMatchesExistingPrefix) {
    return {
      kind: 'trim' as const,
      insert: [],
      removeIds: existing.slice(incoming.length).map((row) => row.id),
    };
  }

  for (let prependCount = 1; prependCount < incoming.length; prependCount += 1) {
    const retainedCount = incoming.length - prependCount;
    if (retainedCount > existing.length) continue;
    const retainedSnapshotsMatch = incoming
      .slice(prependCount)
      .every((row, index) => historySnapshotMatches(existing[index], row));
    if (retainedSnapshotsMatch) {
      return {
        kind: 'prepend' as const,
        insert: incoming.slice(0, prependCount),
        removeIds: existing.slice(retainedCount).map((row) => row.id),
      };
    }
  }

  if (existing.length === 0) {
    return { kind: 'prepend' as const, insert: incoming, removeIds: [] };
  }

  return { kind: 'replace' as const, insert: incoming, removeIds: existing.map((row) => row.id) };
}

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
    }

    const token = auth.substring(7);
    const session = await verifySession(token);

    if (!process.env.DATABASE_URL) {
      return jsonResponse({ error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId') || 'default';

    const userHistory = await db.query.history.findMany({
      where: and(
        eq(history.userId, session.userId),
        eq(history.profileId, profileId)
      ),
      orderBy: desc(history.playedAt),
      limit: 50,
    });

    return jsonResponse({
      history: userHistory.map(trackSnapshotFromRow),
    });
  } catch (error) {
    return jsonResponse(
      {
        error: 'sync_get_history_failed',
        message: error instanceof Error ? error.message : 'Failed to retrieve listening history.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
    }

    const token = auth.substring(7);
    const session = await verifySession(token);
    const { history: clientHistory, profileId: payloadProfileId } = await request.json();
    const profileId = payloadProfileId || 'default';

    if (!Array.isArray(clientHistory)) {
      return jsonResponse({ error: 'invalid_payload', message: 'History payload must be an array.' }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return jsonResponse({ error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' }, { status: 500 });
    }

    const normalizedHistory = clientHistory.slice(0, 50).map((h: { id: string; sourceId?: string }) => ({
      sourceId: h.sourceId || 'youtube_music',
      trackId: h.id,
      ...trackSnapshotColumns(h, h.id),
    }));
    const existingHistory = await db
      .select({
        id: history.id,
        sourceId: history.sourceId,
        trackId: history.trackId,
        title: history.title,
        artistsJson: history.artistsJson,
        artworkUrl: history.artworkUrl,
        durationMs: history.durationMs,
        playedAt: history.playedAt,
      })
      .from(history)
      .where(and(
        eq(history.userId, session.userId),
        eq(history.profileId, profileId)
      ))
      .orderBy(desc(history.playedAt))
      .limit(51);

    const plan = planHistorySnapshotChanges(existingHistory, normalizedHistory);
    if (plan.kind === 'unchanged') {
      return jsonResponse({ success: true, count: clientHistory.length });
    }

    const batch = [];
    if (plan.kind === 'replace') {
      batch.push(db.delete(history).where(and(
        eq(history.userId, session.userId),
        eq(history.profileId, profileId)
      )));
    } else if (plan.removeIds.length > 0) {
      batch.push(db.delete(history).where(and(
        eq(history.userId, session.userId),
        eq(history.profileId, profileId),
        inArray(history.id, plan.removeIds),
      )));
    }

    if (plan.insert.length > 0) {
      const newestStoredTime = existingHistory[0]?.playedAt.getTime() ?? 0;
      const baseTime = plan.kind === 'prepend'
        ? Math.max(Date.now(), newestStoredTime + plan.insert.length)
        : Date.now();
      const payload = plan.insert.map((item, i) => ({
        userId: session.userId,
        profileId,
        ...item,
        playedAt: new Date(baseTime - (plan.kind === 'prepend' ? i : i * 1000)),
        msListened: 30000,
      }));
      batch.push(db.insert(history).values(payload));
    }

    if (batch.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.batch(batch as any);
    }

    return jsonResponse({ success: true, count: clientHistory.length });
  } catch (error) {
    return jsonResponse(
      {
        error: 'sync_post_history_failed',
        message: error instanceof Error ? error.message : 'Failed to synchronize listening history.',
      },
      { status: 500 }
    );
  }
}
