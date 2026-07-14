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
  msListened: number;
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
    && existing.durationMs === incoming.durationMs
    && existing.msListened === incoming.msListened;
}

function historyIdentityMatches(existing: NormalizedHistoryItem, incoming: NormalizedHistoryItem) {
  return existing.sourceId === incoming.sourceId && existing.trackId === incoming.trackId;
}

export function preserveMonotonicListenCredit(
  existing: NormalizedHistoryItem[],
  incoming: NormalizedHistoryItem[],
) {
  const existingByTrack = new Map(existing.map((row) => [
    JSON.stringify([row.sourceId, row.trackId]),
    row,
  ]));
  return incoming.map((row) => {
    const stored = existingByTrack.get(JSON.stringify([row.sourceId, row.trackId]));
    return stored && stored.msListened > row.msListened
      ? { ...row, msListened: stored.msListened }
      : row;
  });
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
  if (historySnapshotsMatch(existing, incoming)) {
    return { kind: 'unchanged' as const, insert: [], removeIds: [] };
  }

  if (
    existing.length === incoming.length
    && incoming.every((row, index) => historyIdentityMatches(existing[index], row))
  ) {
    return {
      kind: 'patch' as const,
      insert: [],
      removeIds: [],
      update: incoming.flatMap((row, index) => (
        historySnapshotMatches(existing[index], row)
          ? []
          : [{ id: existing[index].id, item: row }]
      )),
    };
  }

  for (let promotedIndex = 1; promotedIndex < existing.length; promotedIndex += 1) {
    if (!historyIdentityMatches(existing[promotedIndex], incoming[0])) continue;
    const reorderedExisting = [
      existing[promotedIndex],
      ...existing.slice(0, promotedIndex),
      ...existing.slice(promotedIndex + 1),
    ];
    if (
      reorderedExisting.length === incoming.length
      && incoming.slice(1).every((row, index) => (
        historySnapshotMatches(reorderedExisting[index + 1], row)
      ))
    ) {
      return {
        kind: 'promote' as const,
        insert: [],
        removeIds: [],
        update: [{ id: existing[promotedIndex].id, item: incoming[0] }],
      };
    }
  }

  const incomingMatchesExistingPrefix = incoming.every((row, index) => (
    index < existing.length && historySnapshotMatches(existing[index], row)
  ));

  // A late snapshot from this or another device may contain an older suffix
  // only. Treat it as stale rather than deleting newer listens it never saw.
  const incomingIsStoredSuffixOrSubset = incoming.length > 0
    && incoming.length < existing.length
    && !incomingMatchesExistingPrefix
    && incoming.every((row) => existing.some((stored) => historySnapshotMatches(stored, row)));
  if (incomingIsStoredSuffixOrSubset) {
    return { kind: 'unchanged' as const, insert: [], removeIds: [] };
  }

  if (existing.length > 50) {
    return { kind: 'replace' as const, insert: incoming, removeIds: existing.map((row) => row.id) };
  }

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

    const normalizedHistory = clientHistory.slice(0, 50).map((h: {
      id: string;
      sourceId?: string;
      msListened?: number;
    }) => ({
      sourceId: h.sourceId || 'youtube_music',
      trackId: h.id,
      ...trackSnapshotColumns(h, h.id),
      msListened: Number.isFinite(h.msListened)
        ? Math.max(0, Math.min(600_000, Math.round(h.msListened!)))
        : 30_000,
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
        msListened: history.msListened,
        playedAt: history.playedAt,
      })
      .from(history)
      .where(and(
        eq(history.userId, session.userId),
        eq(history.profileId, profileId)
      ))
      .orderBy(desc(history.playedAt))
      .limit(51);

    const monotonicHistory = preserveMonotonicListenCredit(existingHistory, normalizedHistory);
    const plan = planHistorySnapshotChanges(existingHistory, monotonicHistory);
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

    if (plan.kind === 'patch' || plan.kind === 'promote') {
      const newestStoredTime = existingHistory[0]?.playedAt.getTime() ?? 0;
      for (const update of plan.update) {
        batch.push(db.update(history)
          .set({
            title: update.item.title,
            artistsJson: update.item.artistsJson,
            artworkUrl: update.item.artworkUrl,
            durationMs: update.item.durationMs,
            msListened: update.item.msListened,
            ...(plan.kind === 'promote'
              ? { playedAt: new Date(Math.max(Date.now(), newestStoredTime + 1)) }
              : {}),
          })
          .where(and(
            eq(history.userId, session.userId),
            eq(history.profileId, profileId),
            eq(history.id, update.id),
          )));
      }
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
