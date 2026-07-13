import { jsonResponse, optionsResponse } from '@/lib/cors';
import { verifySession } from '@/lib/auth';
import { db } from '@/db';
import { likes } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { trackSnapshotColumns, trackSnapshotFromRow } from '@/lib/track-snapshot';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

type NormalizedLike = {
  sourceId: string;
  trackId: string;
  title: string;
  artistsJson: string;
  artworkUrl: string | null;
  durationMs: number | null;
};

function likeIdentityKey(row: NormalizedLike) {
  return JSON.stringify([row.sourceId, row.trackId]);
}

function likeMetadataMatches(existing: NormalizedLike, incoming: NormalizedLike) {
  return existing.title === incoming.title
    && existing.artistsJson === incoming.artistsJson
    && existing.artworkUrl === incoming.artworkUrl
    && existing.durationMs === incoming.durationMs;
}

export function planLikeSnapshotChanges(existing: NormalizedLike[], incoming: NormalizedLike[]) {
  const existingByKey = new Map(existing.map((row) => [likeIdentityKey(row), row]));
  const incomingByKey = new Map(incoming.map((row) => [likeIdentityKey(row), row]));

  return {
    remove: existing.filter((row) => !incomingByKey.has(likeIdentityKey(row))),
    insert: incoming.filter((row) => !existingByKey.has(likeIdentityKey(row))),
    update: incoming.filter((row) => {
      const stored = existingByKey.get(likeIdentityKey(row));
      return stored ? !likeMetadataMatches(stored, row) : false;
    }),
  };
}

export function likeSnapshotsMatch(existing: NormalizedLike[], incoming: NormalizedLike[]) {
  const plan = planLikeSnapshotChanges(existing, incoming);
  return plan.remove.length === 0 && plan.insert.length === 0 && plan.update.length === 0;
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

    const userLikes = await db.query.likes.findMany({
      where: and(
        eq(likes.userId, session.userId),
        eq(likes.profileId, profileId)
      ),
    });

    return jsonResponse({
      likedTracks: userLikes.map((like: typeof likes.$inferSelect) => like.trackId),
      likedTrackDetails: Object.fromEntries(
        userLikes.map((like: typeof likes.$inferSelect) => [like.trackId, trackSnapshotFromRow(like)]),
      ),
    });
  } catch (error) {
    return jsonResponse(
      {
        error: 'sync_get_likes_failed',
        message: error instanceof Error ? error.message : 'Failed to retrieve cloud favorites.',
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
    const { likedTracks, likedTrackDetails = {}, profileId: payloadProfileId } = await request.json();
    const profileId = payloadProfileId || 'default';

    if (!Array.isArray(likedTracks)) {
      return jsonResponse({ error: 'invalid_payload', message: 'Payload must be an array of track IDs.' }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return jsonResponse({ error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' }, { status: 500 });
    }

    const uniqueTracks = Array.from(new Set(likedTracks));
    const normalizedLikes = uniqueTracks.map(id => ({
      sourceId: likedTrackDetails[id as string]?.sourceId || 'youtube_music',
      trackId: id as string,
      ...trackSnapshotColumns(likedTrackDetails[id as string], id as string),
    }));
    const existingLikes = await db
      .select({
        sourceId: likes.sourceId,
        trackId: likes.trackId,
        title: likes.title,
        artistsJson: likes.artistsJson,
        artworkUrl: likes.artworkUrl,
        durationMs: likes.durationMs,
      })
      .from(likes)
      .where(and(
        eq(likes.userId, session.userId),
        eq(likes.profileId, profileId)
      ));

    const plan = planLikeSnapshotChanges(existingLikes, normalizedLikes);
    if (plan.remove.length === 0 && plan.insert.length === 0 && plan.update.length === 0) {
      return jsonResponse({ success: true, count: likedTracks.length });
    }

    const batch = [];
    if (plan.remove.length > 0) {
      batch.push(db.delete(likes).where(and(
        eq(likes.userId, session.userId),
        eq(likes.profileId, profileId),
        or(...plan.remove.map((item) => and(
          eq(likes.sourceId, item.sourceId),
          eq(likes.trackId, item.trackId),
        ))),
      )));
    }

    if (plan.insert.length > 0) {
      const payload = plan.insert.map(item => ({
        userId: session.userId,
        profileId,
        ...item,
      }));
      batch.push(db.insert(likes).values(payload));
    }

    for (const item of plan.update) {
      batch.push(db.update(likes)
        .set({
          title: item.title,
          artistsJson: item.artistsJson,
          artworkUrl: item.artworkUrl,
          durationMs: item.durationMs,
        })
        .where(and(
          eq(likes.userId, session.userId),
          eq(likes.profileId, profileId),
          eq(likes.sourceId, item.sourceId),
          eq(likes.trackId, item.trackId),
        )));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.batch(batch as any);

    return jsonResponse({ success: true, count: likedTracks.length });
  } catch (error) {
    return jsonResponse(
      {
        error: 'sync_post_likes_failed',
        message: error instanceof Error ? error.message : 'Failed to synchronize favorites.',
      },
      { status: 500 }
    );
  }
}
