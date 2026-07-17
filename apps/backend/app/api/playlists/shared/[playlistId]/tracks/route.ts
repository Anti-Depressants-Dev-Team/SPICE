import type { NextRequest } from 'next/server';

import { verifySession } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/cors';
import { db } from '@/db';
import { playlists, playlistItems, playlistMembers, users, profiles } from '@/db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { trackSnapshotColumns, trackSnapshotFromRow } from '@/lib/track-snapshot';
import type { TrackSnapshotInput } from '@/lib/track-snapshot';
import { findPlaylistTrackPosition } from '@/lib/playlist-sync';

export const runtime = 'nodejs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function OPTIONS() {
  return optionsResponse();
}

/**
 * Verify the caller is the owner or an editor member of the playlist.
 * Returns { playlist, isOwner, role } or null.
 */
async function verifyPlaylistAccess(playlistId: string, userId: string) {
  const playlist = await db.query.playlists.findFirst({
    where: and(eq(playlists.id, playlistId), isNull(playlists.deletedAt)),
  });
  if (!playlist) return null;

  if (playlist.userId === userId) {
    return { playlist, isOwner: true, role: 'owner' as const };
  }

  const membership = await db.query.playlistMembers.findFirst({
    where: and(
      eq(playlistMembers.playlistId, playlistId),
      eq(playlistMembers.userId, userId),
      eq(playlistMembers.status, 'accepted'),
    ),
  });
  if (!membership) return null;

  return { playlist, isOwner: false, role: membership.role as 'editor' | 'listener' };
}

/**
 * GET — Fetch current tracks in a shared playlist (members and owner).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> },
) {
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

    const { playlistId } = await params;
    if (!uuidPattern.test(playlistId)) {
      return jsonResponse({ error: 'invalid_playlist_id', message: 'Playlist id must be a UUID.' }, { status: 400 });
    }

    const access = await verifyPlaylistAccess(playlistId, session.userId);
    if (!access) {
      return jsonResponse(
        { error: 'forbidden', message: 'You do not have access to this playlist.' },
        { status: 403 },
      );
    }

    const items = await db.query.playlistItems.findMany({
      where: eq(playlistItems.playlistId, playlistId),
      orderBy: playlistItems.position,
    });

    // Build addedBy map
    const addedByUserIds = new Set(
      items.map((item) => item.addedByUserId).filter((id): id is string => !!id),
    );
    const addedByMap: Record<string, { username: string | null; displayName: string }> = {};
    const uidsArray = Array.from(addedByUserIds);
    if (uidsArray.length > 0) {
      const [fetchedUsers, fetchedProfiles] = await Promise.all([
        db.query.users.findMany({ where: inArray(users.id, uidsArray) }),
        db.query.profiles.findMany({
          where: inArray(profiles.userId, uidsArray),
        }),
      ]);

      const userMap = new Map(fetchedUsers.map(u => [u.id, u]));
      const profileMap = new Map(fetchedProfiles.map(p => [p.userId, p]));

      for (const uid of uidsArray) {
        const user = userMap.get(uid);
        const profile = profileMap.get(uid);
        addedByMap[uid] = {
          username: user?.username || null,
          displayName: profile?.displayName || user?.email || 'Unknown',
        };
      }
    }

    const tracks = items.map((item) => {
      const base = trackSnapshotFromRow(item);
      const addedBy = item.addedByUserId && addedByMap[item.addedByUserId]
        ? { userId: item.addedByUserId, ...addedByMap[item.addedByUserId] }
        : undefined;
      return {
        ...base,
        position: item.position,
        ...(addedBy ? { addedBy } : {}),
      };
    });

    return jsonResponse({ tracks, playlistId, role: access.role });
  } catch (error) {
    return jsonResponse(
      {
        error: 'tracks_fetch_failed',
        message: error instanceof Error ? error.message : 'Failed to fetch playlist tracks.',
      },
      { status: 500 },
    );
  }
}



/**
 * POST — Add a track to a shared playlist.
 * Body: { track: TrackSnapshotInput }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> },
) {
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

    const { playlistId } = await params;
    if (!uuidPattern.test(playlistId)) {
      return jsonResponse({ error: 'invalid_playlist_id', message: 'Playlist id must be a UUID.' }, { status: 400 });
    }

    const access = await verifyPlaylistAccess(playlistId, session.userId);
    if (!access || (access.role !== 'editor' && !access.isOwner)) {
      return jsonResponse(
        { error: 'forbidden', message: 'You do not have editor access to this playlist.' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const track = body.track as TrackSnapshotInput | undefined;
    if (!track || typeof track.id !== 'string' || !track.id) {
      return jsonResponse({ error: 'invalid_track', message: 'A track with an id is required.' }, { status: 400 });
    }

    const sourceId = track.sourceId || 'youtube_music';
    const snapshot = trackSnapshotColumns(track, track.id);

    // Serialize mutations for this shared playlist inside Neon's HTTP batch
    // transaction. This makes repeat taps idempotent without imposing a global
    // uniqueness rule on private/imported playlists, where repeated songs are
    // valid ordered entries.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const [, mutationResult] = await db.batch([
        db.execute(sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${playlistId}, 0))
        `),
        db.execute<{ position: number; alreadyExists: boolean }>(sql`
          WITH existing AS (
            SELECT position
            FROM playlist_items
            WHERE playlist_id = ${playlistId}
              AND source_id = ${sourceId}
              AND track_id = ${track.id}
            ORDER BY position
            LIMIT 1
          ), inserted AS (
            INSERT INTO playlist_items (
              playlist_id,
              position,
              source_id,
              track_id,
              title,
              artists_json,
              artwork_url,
              duration_ms,
              added_by_user_id
            )
            SELECT
              ${playlistId},
              COALESCE(MAX(position) + 1, 0),
              ${sourceId},
              ${track.id},
              ${snapshot.title},
              ${snapshot.artistsJson},
              ${snapshot.artworkUrl},
              ${snapshot.durationMs},
              ${session.userId}
            FROM playlist_items
            WHERE playlist_id = ${playlistId}
            HAVING NOT EXISTS (SELECT 1 FROM existing)
            ON CONFLICT (playlist_id, position) DO NOTHING
            RETURNING position
          )
          SELECT position, false AS "alreadyExists" FROM inserted
          UNION ALL
          SELECT position, true AS "alreadyExists" FROM existing
          LIMIT 1
        `),
      ]);
      const result = mutationResult.rows[0];
      if (result) {
        return jsonResponse({
          success: true,
          alreadyExists: result.alreadyExists,
          position: result.position,
        });
      }
    }

    const finalItems = await db.query.playlistItems.findMany({
      where: eq(playlistItems.playlistId, playlistId),
      orderBy: playlistItems.position,
    });
    const finalPosition = findPlaylistTrackPosition(finalItems, track);
    if (finalPosition !== null) {
      return jsonResponse({ success: true, alreadyExists: true, position: finalPosition });
    }
    throw new Error('The playlist changed too quickly. Please try adding the track again.');
  } catch (error) {
    return jsonResponse(
      {
        error: 'track_add_failed',
        message: error instanceof Error ? error.message : 'Failed to add track to shared playlist.',
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE — Remove a track from a shared playlist.
 * Body: { position: number }
 * Members can only remove tracks they added. Owner can remove any.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> },
) {
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

    const { playlistId } = await params;
    if (!uuidPattern.test(playlistId)) {
      return jsonResponse({ error: 'invalid_playlist_id', message: 'Playlist id must be a UUID.' }, { status: 400 });
    }

    const access = await verifyPlaylistAccess(playlistId, session.userId);
    if (!access || (access.role !== 'editor' && !access.isOwner)) {
      return jsonResponse(
        { error: 'forbidden', message: 'You do not have editor access to this playlist.' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const position = typeof body.position === 'number' ? body.position : -1;
    if (position < 0) {
      return jsonResponse({ error: 'invalid_position', message: 'A valid track position is required.' }, { status: 400 });
    }

    const itemFilter = and(
      eq(playlistItems.playlistId, playlistId),
      eq(playlistItems.position, position),
    );
    const deleteFilter = access.isOwner
      ? itemFilter
      : and(itemFilter, eq(playlistItems.addedByUserId, session.userId));
    const [, deletedItems, remainingItems] = await db.batch([
      db.execute(sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${playlistId}, 0))
      `),
      db.delete(playlistItems)
        .where(deleteFilter)
        .returning({ position: playlistItems.position }),
      db.select({ addedByUserId: playlistItems.addedByUserId })
        .from(playlistItems)
        .where(itemFilter)
        .limit(1),
    ]);

    if (!deletedItems[0]) {
      if (remainingItems[0] && !access.isOwner) {
        return jsonResponse(
          { error: 'forbidden', message: 'You can only remove tracks you added.' },
          { status: 403 },
        );
      }
      return jsonResponse(
        { error: 'track_not_found', message: 'Track not found at that position.' },
        { status: 404 },
      );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse(
      {
        error: 'track_remove_failed',
        message: error instanceof Error ? error.message : 'Failed to remove track from shared playlist.',
      },
      { status: 500 },
    );
  }
}
